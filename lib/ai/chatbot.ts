import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { formatSlot, isOpen, STAGE_LONG_LABEL, stageOf, ticketTitle, type Ticket } from "@/lib/domain";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyQuickFixOutcome } from "@/lib/tickets";
import { claudeConfigured } from "./claude";
import { logAiCall } from "./log";
import { EVACUATE_ADVICE } from "./safety";

// The chatbot in Messages (architecture §5.6): quick fixes grounded in the building's guides,
// "why is my room cold?" from the tenant's own sensor events, and status answers from ticket data.
// Claude (effort medium) with three tools; without an API key, simple rules keep the demo running.

type Admin = ReturnType<typeof createAdminClient>;

const MODEL = "claude-opus-5-5";

export type ChatTenant = { id: string; name: string; unit: { id: string; number: string }; building: { id: string; name: string } };
export type ChatTurn = { role: "tenant" | "assistant"; text: string };

// ---------------------------------------------------------------- data the bot may use

type TicketSummary = {
  id: string;
  title: string;
  stage: string;
  status: string;
  summary: string | null;
  open: boolean;
  quick_fix: string | null;
  appointment: string | null;
  building_wide: boolean;
};

async function myTickets(admin: Admin, tenant: ChatTenant): Promise<TicketSummary[]> {
  const { data } = await admin
    .from("tickets")
    .select("*, appointments(starts_at, ends_at, status, technician:technicians(name, trade))")
    .or(`unit_id.eq.${tenant.unit.id},and(scope.eq.building,building_id.eq.${tenant.building.id})`)
    .order("created_at", { ascending: false })
    .limit(15);
  return ((data ?? []) as (Ticket & { appointments: { starts_at: string; ends_at: string; status: string; technician: { name: string; trade: string } }[] })[]).map((t) => {
    const appt = t.appointments.find((a) => a.status === "booked" || a.status === "proposed");
    const stage = stageOf(t.status);
    return {
      id: t.id,
      title: t.classified_by ? ticketTitle(t) : "New report",
      stage: stage ? STAGE_LONG_LABEL[stage] : "Closed without a repair",
      status: t.status,
      summary: t.summary,
      open: isOpen(t),
      quick_fix: t.status === "quick_fix" ? t.quick_fix_text : null,
      appointment: appt ? `${appt.technician.name} (${appt.technician.trade}), ${formatSlot(appt.starts_at, appt.ends_at)}${appt.status === "proposed" ? ", waiting for the landlord to confirm" : ""}` : null,
      building_wide: t.scope === "building",
    };
  });
}

async function mySensorEvents(admin: Admin, tenant: ChatTenant) {
  const { data } = await admin
    .from("sensor_events")
    .select("metric, value, duration, details, occurred_at, confirmation")
    .eq("unit_id", tenant.unit.id)
    .order("reported_at", { ascending: false })
    .limit(5);
  return data ?? [];
}

async function guidesFor(admin: Admin, buildingId: string) {
  const { data } = await admin.from("buildings").select("quick_fix_guides").eq("id", buildingId).single();
  return (data?.quick_fix_guides as string | undefined)?.trim() ?? "";
}

/** Tool actions only touch the tenant's own quick-fix tickets. */
async function quickFixTicket(admin: Admin, tenant: ChatTenant, ticketId: string | undefined) {
  const tickets = await myTickets(admin, tenant);
  const candidates = tickets.filter((t) => t.status === "quick_fix" && !t.building_wide);
  return candidates.find((t) => t.id === ticketId) ?? (candidates.length === 1 ? candidates[0] : null);
}

// ---------------------------------------------------------------- Claude

const SYSTEM = `You are Fixa's assistant in a rental-housing app. You talk to one tenant about their flat.
Write plain, warm British English, short (2–5 sentences or a short numbered list). Never invent ticket data: use get_my_tickets.
You can:
- Give quick-fix guides for small problems a tenant can safely fix (bleeding a radiator, resetting a tripped switch, re-sealing a window). Prefer the landlord's guides below when they cover it.
- Explain "why is my room cold?" from the tenant's sensor events and tickets.
- Answer status questions (what stage, when the technician comes) from get_my_tickets.
- If the tenant says a quick fix worked, call mark_fixed. If it didn't, call escalate_to_technician. Every quick fix must end fixed or escalated.
Never give gas, electrical-wiring or structural DIY advice. For gas, smoke or sparks say: "${EVACUATE_ADVICE}" and ask them to report it with the Add button.
To report a new problem, tell them to tap Add and send a photo, video or voice memo.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_my_tickets",
    description: "The tenant's tickets (their flat and building-wide ones) with stage, summary, quick-fix text and appointment, plus their flat's recent sensor events.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
    strict: true,
  },
  {
    name: "escalate_to_technician",
    description: "The tenant tried the quick fix and it didn't work: switch that ticket to booking a technician.",
    input_schema: { type: "object", properties: { ticket_id: { type: "string" } }, required: ["ticket_id"], additionalProperties: false },
    strict: true,
  },
  {
    name: "mark_fixed",
    description: "The tenant says the quick fix worked: close that ticket.",
    input_schema: { type: "object", properties: { ticket_id: { type: "string" } }, required: ["ticket_id"], additionalProperties: false },
    strict: true,
  },
];

async function runTool(admin: Admin, tenant: ChatTenant, name: string, input: Record<string, unknown>) {
  if (name === "get_my_tickets") {
    return JSON.stringify({ tickets: await myTickets(admin, tenant), sensor_events: await mySensorEvents(admin, tenant) });
  }
  if (name === "escalate_to_technician" || name === "mark_fixed") {
    const t = await quickFixTicket(admin, tenant, input.ticket_id as string | undefined);
    if (!t) return JSON.stringify({ error: "No open quick-fix ticket with that id." });
    await applyQuickFixOutcome(admin, t.id, name === "mark_fixed");
    return JSON.stringify({ ok: true, ticket: t.title, now: name === "mark_fixed" ? "resolved" : "waiting for the tenant's availability to book a technician" });
  }
  return JSON.stringify({ error: "Unknown tool" });
}

async function replyWithClaude(admin: Admin, tenant: ChatTenant, history: ChatTurn[]): Promise<string> {
  const client = new Anthropic();
  const guides = await guidesFor(admin, tenant.building.id);
  const system = `${SYSTEM}\n\nTenant: flat ${tenant.unit.number}, ${tenant.building.name}.\nLandlord's quick-fix guides for this building:\n${guides || "(none)"}`;
  const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role === "tenant" ? "user" : "assistant", content: m.text }));
  const started = Date.now();

  for (let round = 0; round < 5; round++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      output_config: { effort: "medium" },
      system,
      tools: TOOLS,
      tool_choice: { type: "auto" },
      messages,
    });
    if (response.stop_reason === "refusal") throw new Error("Claude declined to answer");
    if (response.stop_reason !== "tool_use") {
      const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
      await logAiCall({ provider: "claude", model: response.model, purpose: "chatbot", input_ref: `tenant:${tenant.id}`, output: { text, usage: response.usage }, latency_ms: Date.now() - started });
      if (!text) throw new Error("Empty reply");
      return text;
    }
    messages.push({ role: "assistant", content: response.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      results.push({ type: "tool_result", tool_use_id: block.id, content: await runTool(admin, tenant, block.name, block.input as Record<string, unknown>) });
    }
    messages.push({ role: "user", content: results });
  }
  throw new Error("Too many tool rounds");
}

// ---------------------------------------------------------------- rules (no API key)

const GUIDES: { re: RegExp; text: string }[] = [
  {
    re: /\b(radiator|bleed|gurgl\w*|warm at the bottom|heating)\b/i,
    text: "To bleed a radiator:\n1. Turn the thermostat to the highest setting.\n2. Hold a towel under the bleed valve at the top corner.\n3. Open it a quarter turn with a radiator key until water, not air, comes out.\n4. Close it and wait 30 minutes.",
  },
  {
    re: /\b(trip\w*|fuse|no power|socket|outlet|switch)\b/i,
    text: "To reset a tripped switch:\n1. Open the fuse box (usually in the hallway).\n2. Find the switch pointing down.\n3. Unplug the appliances on that circuit, then flip the switch back up.\n4. If it trips again straight away, leave it off and report it with the Add button.",
  },
  {
    re: /\b(window|draught|draft|seal\w*)\b/i,
    text: "For a draughty window:\n1. Check the handle closes fully and the seal isn't twisted.\n2. Clean the seal with a damp cloth.\n3. If the gap stays, report it with a photo and we'll log it for the next visit.",
  },
];

function guideFromLandlord(guides: string, question: string) {
  if (!guides) return null;
  const words = question.toLowerCase().match(/[a-zäöüß]{4,}/g) ?? [];
  const sections = guides.split(/\n(?=#+ )|\n{2,}/).map((s) => s.trim()).filter(Boolean);
  let best: { s: string; score: number } | null = null;
  for (const s of sections) {
    const lower = s.toLowerCase();
    const score = words.filter((w) => lower.includes(w)).length;
    if (score > 0 && (!best || score > best.score)) best = { s, score };
  }
  return best?.s ?? null;
}

async function replyByRules(admin: Admin, tenant: ChatTenant, question: string): Promise<string> {
  const q = question.toLowerCase();
  if (/\b(gas|smoke|sparks?|burning|fire)\b/.test(q)) return `${EVACUATE_ADVICE} Then report it with the Add button so your landlord is alerted.`;

  const tickets = await myTickets(admin, tenant);
  const quickFixes = tickets.filter((t) => t.status === "quick_fix" && !t.building_wide);

  if (quickFixes.length && /\b(didn'?t work|not work\w*|still|doesn'?t work|no luck|send (a |someone|technician))\b/.test(q)) {
    await applyQuickFixOutcome(admin, quickFixes[0].id, false);
    return `Sorry it didn't work. I've switched "${quickFixes[0].title}" to a technician visit. Open the ticket and pick a few times when you're home.`;
  }
  if (quickFixes.length && /\b(fixed|worked|works now|it works|sorted|all good)\b/.test(q)) {
    await applyQuickFixOutcome(admin, quickFixes[0].id, true);
    return `Great, glad that worked. I've closed "${quickFixes[0].title}". It's in your History.`;
  }

  if (/\b(cold|chilly|freezing)\b/.test(q)) {
    const events = await mySensorEvents(admin, tenant);
    const temp = events.find((e) => e.metric === "temperature");
    const heating = tickets.find((t) => t.open && /heating/i.test(t.title));
    const parts: string[] = [];
    if (temp) parts.push(`Your flat's sensor measured ${temp.details ?? temp.value}.`);
    if (heating) {
      parts.push(
        heating.building_wide
          ? `It's part of a building-wide heating problem we already know about (${heating.stage.toLowerCase()}${heating.appointment ? `: ${heating.appointment}` : ""}).`
          : `Your heating ticket is at "${heating.stage}"${heating.appointment ? `: ${heating.appointment}` : ""}.`,
      );
    } else {
      parts.push("If only one radiator is cold, bleeding it often helps:\n" + GUIDES[0].text.split("\n").slice(1).join("\n"));
      parts.push("If the whole flat is cold, report it with the Add button.");
    }
    return parts.join(" ");
  }

  if (/\b(status|when|coming|appointment|technician|update|progress|ticket)\b/.test(q)) {
    const open = tickets.filter((t) => t.open);
    if (!open.length) return "You have no open tickets right now. To report something, tap Add and send a photo, video or voice memo.";
    return open
      .slice(0, 4)
      .map((t) => `• ${t.title}: ${t.stage}${t.appointment ? `. ${t.appointment}` : t.status === "quick_fix" ? ". A quick fix is waiting for you to try" : ""}.`)
      .join("\n");
  }

  const fromLandlord = guideFromLandlord(await guidesFor(admin, tenant.building.id), question);
  if (fromLandlord) return `Your landlord's guide:\n${fromLandlord}`;
  const guide = GUIDES.find((g) => g.re.test(question));
  if (guide) return guide.text;

  return "I can help with small fixes (radiators, tripped switches, draughty windows), tell you where your repairs are, or explain sensor alerts. To report a new problem, tap Add and send a photo, video or voice memo.";
}

// ---------------------------------------------------------------- entry point

/** Stores the tenant's message, answers it and stores the reply. */
export async function chat(tenant: ChatTenant, text: string): Promise<string> {
  const admin = createAdminClient();
  await admin.from("chat_messages").insert({ tenant_id: tenant.id, role: "tenant", text });
  const { data: rows } = await admin.from("chat_messages").select("role, text").eq("tenant_id", tenant.id).order("created_at", { ascending: false }).limit(20);
  const history = ((rows ?? []) as ChatTurn[]).reverse();

  let reply: string;
  if (claudeConfigured()) {
    try {
      reply = await replyWithClaude(admin, tenant, history);
    } catch (err) {
      console.error("Chatbot failed", err);
      await logAiCall({ provider: "claude", model: MODEL, purpose: "chatbot", input_ref: `tenant:${tenant.id}`, error: err instanceof Error ? err.message : String(err) });
      reply = await replyByRules(admin, tenant, text);
    }
  } else {
    reply = await replyByRules(admin, tenant, text);
    await logAiCall({ provider: "rules", purpose: "chatbot", input_ref: `tenant:${tenant.id}`, output: { reply } });
  }
  await admin.from("chat_messages").insert({ tenant_id: tenant.id, role: "assistant", text: reply });
  return reply;
}
