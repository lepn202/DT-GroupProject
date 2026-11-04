import "server-only";
import { classify } from "@/lib/ai/classify";
import type { ClassifierInput } from "@/lib/ai/types";
import { computeDueAt, ticketTitle, withArticle, type DueHours, type Ticket } from "@/lib/domain";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;
type Actor = "ai" | "tenant" | "landlord" | "technician" | "system";

export async function addEvent(admin: Admin, ticketId: string, type: string, actor: Actor, data: Record<string, unknown> = {}) {
  await admin.from("ticket_events").insert({ ticket_id: ticketId, type, actor, data });
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
      await addMessage(
        admin,
        ticketId,
        "ai",
        result.urgency === "emergency"
          ? "Received. This is urgent, so your landlord has been alerted and will book a technician straight away."
          : `Received, we're on it. This needs ${withArticle(result.trade === "none" || result.trade === "heating" ? "technician" : result.trade)} visit; we'll ask when you're home so we can book one.`,
      );
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
