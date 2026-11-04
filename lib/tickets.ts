import "server-only";
import { classify } from "@/lib/ai/classify";
import type { ClassifierInput } from "@/lib/ai/types";
import { computeDueAt, ticketTitle, withArticle, type DueHours, type Ticket, type TicketStatus } from "@/lib/domain";
import { notifyLandlordOfBuilding } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;
type Actor = "ai" | "tenant" | "landlord" | "technician" | "system";

export async function addEvent(admin: Admin, ticketId: string, type: string, actor: Actor, data: Record<string, unknown> = {}) {
  await admin.from("ticket_events").insert({ ticket_id: ticketId, type, actor, data });
}

/**
 * Sets a ticket's status, logs it on the timeline and keeps grouped flat tickets (children)
 * in step with it, so every affected tenant sees the same progress (architecture §5.5).
 */
export async function setStatus(
  admin: Admin,
  ticketId: string,
  status: TicketStatus,
  actor: Actor,
  data: Record<string, unknown> = {},
  extra: Record<string, unknown> = {},
) {
  const resolvedAt = status === "resolved" ? new Date().toISOString() : null;
  const update = { status, resolved_at: resolvedAt, ...extra };
  await admin.from("tickets").update(update).eq("id", ticketId);
  await admin.from("tickets").update({ status, resolved_at: resolvedAt }).eq("parent_ticket_id", ticketId);
  await addEvent(admin, ticketId, "status", actor, { status, ...data });
}

/**
 * Outcome of a quick fix (architecture §5.4, §5.6): "Fixed it" closes the ticket,
 * "Didn't work" switches it to scheduling a technician. Every quick fix ends one way or the other.
 */
export async function applyQuickFixOutcome(admin: Admin, ticketId: string, worked: boolean) {
  const { data: t } = await admin.from("tickets").select("status, issue_type").eq("id", ticketId).single();
  if (t?.status !== "quick_fix") return false;
  if (worked) {
    await setStatus(admin, ticketId, "resolved", "tenant", { via: "quick_fix" });
    await addMessage(admin, ticketId, "ai", "Great, glad that worked. We've closed this ticket. It's in your History.");
  } else {
    const { tradeFor } = await import("@/lib/domain");
    await admin.from("tickets").update({ status: "logged", next_step: "schedule_technician", trade: tradeFor(t.issue_type) }).eq("id", ticketId);
    await addEvent(admin, ticketId, "escalated", "tenant", { from: "quick_fix", to: "schedule_technician" });
    await addMessage(admin, ticketId, "ai", "Sorry it didn't work. We'll send a technician. When are you home? Pick a few times below.");
  }
  return true;
}

export async function addMessage(admin: Admin, ticketId: string, from: "ai" | "tenant" | "landlord" | "technician", text: string, authorName?: string) {
  await admin.from("messages").insert({ ticket_id: ticketId, from, text, author_name: authorName ?? null });
}

const IMAGE_EXT = /\.(jpe?g|png)$/i;

/** Creates the ticket and report for a tenant submission. Classification runs afterwards (processTicket). */
export async function createTenantReport(args: {
  tenantId: string;
  unitId: string;
  buildingId: string;
  text: string | null;
  transcript: string | null;
  mediaPaths: string[];
  framePaths: string[];
}) {
  const admin = createAdminClient();
  const { data: ticket, error } = await admin
    .from("tickets")
    .insert({ building_id: args.buildingId, unit_id: args.unitId, status: "logged" })
    .select("id")
    .single();
  if (error || !ticket) throw new Error(error?.message ?? "Could not create ticket");

  const { error: reportError } = await admin.from("reports").insert({
    unit_id: args.unitId,
    tenant_id: args.tenantId,
    source: "tenant",
    text: args.text,
    transcript: args.transcript,
    media_paths: args.mediaPaths,
    frame_paths: args.framePaths,
    ticket_id: ticket.id,
  });
  if (reportError) throw new Error(reportError.message);

  await addEvent(admin, ticket.id, "created", "tenant", {
    media: args.mediaPaths.length,
    voice: Boolean(args.transcript),
  });
  return ticket.id as string;
}

async function loadImages(admin: Admin, paths: string[]): Promise<ClassifierInput["images"]> {
  const images: ClassifierInput["images"] = [];
  for (const path of paths.filter((p) => IMAGE_EXT.test(p)).slice(0, 4)) {
    const { data } = await admin.storage.from("media").download(path);
    if (!data) continue;
    images.push({
      bytes: new Uint8Array(await data.arrayBuffer()),
      mediaType: /\.png$/i.test(path) ? "image/png" : "image/jpeg",
    });
  }
  return images;
}

/** Classifies a logged ticket and carries out its next step (architecture §5.4, "What each next_step does"). */
export async function processTicket(ticketId: string) {
  const admin = createAdminClient();
  const { data: ticket } = await admin.from("tickets").select("*").eq("id", ticketId).single<Ticket>();
  if (!ticket || ticket.classified_by) return;

  const [{ data: reports }, { data: unit }, { data: building }, { data: openTickets }] = await Promise.all([
    admin.from("reports").select("*, sensor_event:sensor_events(*)").eq("ticket_id", ticketId).order("created_at"),
    ticket.unit_id ? admin.from("units").select("number, floor").eq("id", ticket.unit_id).single() : Promise.resolve({ data: null }),
    admin.from("buildings").select("id, landlord:landlords(due_hours)").eq("id", ticket.building_id).single(),
    admin
      .from("tickets")
      .select("id, issue_type, summary, room, scope, unit:units(number)")
      .eq("building_id", ticket.building_id)
      .neq("id", ticketId)
      .not("status", "in", "(resolved,dismissed)")
      .not("classified_by", "is", null)
      .limit(20),
  ]);

  const report = reports?.[0];
  const sensor = report?.sensor_event as { metric: string; value: string; duration: string | null; details: string | null } | null;
  const text = [report?.text, report?.transcript].filter(Boolean).join("\n");
  const images = await loadImages(admin, [...(report?.media_paths ?? []), ...(report?.frame_paths ?? [])]);

  const input: ClassifierInput = {
    text,
    source: report?.source ?? "tenant",
    sensor: sensor ? { metric: sensor.metric, value: sensor.value, duration: sensor.duration, details: sensor.details } : undefined,
    images,
    flat: { number: unit?.number ?? "?", floor: unit?.floor ?? 0 },
    openTickets: (openTickets ?? []).map((t) => ({
      id: t.id,
      label: `${ticketTitle(t as Pick<Ticket, "issue_type" | "summary" | "room" | "scope">)}, flat ${(t.unit as unknown as { number: string } | null)?.number ?? "building"}: ${t.summary ?? ""}`,
    })),
  };

  const result = await classify(input, `ticket:${ticketId}`);
  const dueHours = (building?.landlord as unknown as { due_hours: Partial<DueHours> } | null)?.due_hours ?? null;
  const dueAt = computeDueAt(new Date(ticket.occurred_at), result.urgency, dueHours);

  const status = result.next_step === "quick_fix" ? "quick_fix" : result.next_step === "dismiss" ? "dismissed" : "logged";

  await admin
    .from("tickets")
    .update({
      issue_type: result.issue_type,
      scope: result.scope,
      urgency: result.urgency,
      next_step: result.next_step,
      trade: result.trade,
      room: result.room,
      summary: result.summary,
      quick_fix_text: result.quick_fix_text,
      safety_advice: result.safety_advice,
      classified_by: result.classified_by,
      classification_confidence: result.confidence,
      needs_triage: result.needs_triage,
      due_at: dueAt.toISOString(),
      status,
    })
    .eq("id", ticketId);

  await addEvent(admin, ticketId, "classified", "ai", {
    issue_type: result.issue_type,
    urgency: result.urgency,
    next_step: result.next_step,
    trade: result.trade,
    by: result.classified_by,
    confidence: result.confidence,
    needs_triage: result.needs_triage,
    related_ticket_id: result.related_ticket_id,
  });

  // Same problem as an open ticket: attach to it instead of starting a new booking (§5.5).
  const { attachToRelated, mergeBuildingHeating, warnFlatBelow } = await import("@/lib/grouping");
  if (result.related_ticket_id && result.next_step !== "dismiss" && result.urgency !== "emergency") {
    if (await attachToRelated(admin, ticketId, result.related_ticket_id)) return;
  }

  // Heating sensor events from 3+ flats become one building-wide ticket (§5.5).
  if (result.issue_type === "heating" && report?.source === "sensor") {
    const parentId = await mergeBuildingHeating(admin, ticket.building_id);
    if (parentId && parentId !== ticketId) {
      const { data: now } = await admin.from("tickets").select("parent_ticket_id").eq("id", ticketId).single();
      if (now?.parent_ticket_id) return;
    }
  }

  // Water: warn the flat below straight away (§5.5).
  if (result.next_step !== "dismiss") await warnFlatBelow(admin, { ...ticket, issue_type: result.issue_type, scope: result.scope });

  // Next step.
  switch (result.next_step) {
    case "quick_fix":
      await addMessage(
        admin,
        ticketId,
        "ai",
        `This looks like something you can fix yourself. Here's how:\n\n${result.quick_fix_text ?? ""}\n\nTell us if it worked.`,
      );
      break;
    case "dismiss":
      await addMessage(
        admin,
        ticketId,
        "ai",
        "Thanks for telling us. This doesn't look like something that needs a repair, so we've closed it. If we got it wrong, send a new report with a photo.",
      );
      await addEvent(admin, ticketId, "status", "ai", { status: "dismissed" });
      break;
    case "schedule_technician":
      if (result.urgency === "emergency") {
        // Emergencies skip the tenant's availability step: the landlord books directly (§5.7).
        await addMessage(admin, ticketId, "ai", "Received. This is urgent, so your landlord has been alerted and will book a technician straight away.");
        const { data: u } = ticket.unit_id ? await admin.from("units").select("number").eq("id", ticket.unit_id).single() : { data: null };
        await notifyLandlordOfBuilding(
          admin,
          ticket.building_id,
          {
            kind: "emergency",
            title: `Emergency: ${result.summary}`,
            body: `${u ? `Flat ${u.number}. ` : ""}Book a technician now: the tenant doesn't need to send times first.`,
            link: `/dashboard/tickets/${ticketId}`,
            ticketId,
          },
          { email: true },
        );
      } else if (result.scope === "building") {
        const { bookEarliest } = await import("@/lib/scheduling");
        await addMessage(admin, ticketId, "ai", "Received, we're on it. This affects the whole building, so we're booking one technician visit for everyone.");
        await bookEarliest(admin, ticketId);
      } else {
        await addMessage(
          admin,
          ticketId,
          "ai",
          `Received, we're on it. This needs ${withArticle(result.trade === "none" || result.trade === "heating" ? "technician" : result.trade)} visit. When are you home? Pick a few times below and we'll book the earliest one that fits.`,
        );
      }
      break;
    case "inform_landlord":
      await addMessage(
        admin,
        ticketId,
        "ai",
        "Received, we're on it. We've logged this for your landlord's next planned visit, so there's nothing else you need to do.",
      );
      break;
  }
  if (result.safety_advice) await addMessage(admin, ticketId, "ai", result.safety_advice);
}
