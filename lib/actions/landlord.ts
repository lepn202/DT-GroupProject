"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireLandlord } from "@/lib/auth";
import { computeDueAt, ISSUE_TYPES, NEXT_STEPS, SCOPES, TRADES, URGENCIES, type DueHours, type Ticket } from "@/lib/domain";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { addEvent, addMessage } from "@/lib/tickets";
import { demoEnabled } from "@/lib/config";

export type ActionState = { error?: string; ok?: string } | undefined;

/** Loads a ticket through RLS, so it only resolves for the landlord's own buildings. */
async function ownTicket(ticketId: string) {
  const landlord = await requireLandlord();
  const supabase = await createClient();
  const { data } = await supabase.from("tickets").select("*").eq("id", ticketId).maybeSingle<Ticket>();
  if (!data) throw new Error("Ticket not found");
  return { landlord, ticket: data };
}

// ---------------------------------------------------------------- buildings

const NewBuilding = z.object({
  name: z.string().trim().min(2, "Enter a name, e.g. the street address"),
  address: z.string().trim().min(5, "Enter the full address"),
  floors: z.coerce.number().int().min(1).max(40),
  perFloor: z.coerce.number().int().min(1).max(12),
});

/** Registers a building and generates its units: floors × flats, numbered 1A, 1B, … */
export async function createBuilding(_: ActionState, form: FormData): Promise<ActionState> {
  const landlord = await requireLandlord();
  const parsed = NewBuilding.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, address, floors, perFloor } = parsed.data;

  const supabase = await createClient();
  const { data: building, error } = await supabase
    .from("buildings")
    .insert({ landlord_id: landlord.id, name, address })
    .select("id")
    .single();
  if (error || !building) return { error: error?.message ?? "Could not save the building" };

  const units = [];
  for (let f = 1; f <= floors; f++) {
    for (let p = 0; p < perFloor; p++) {
      const position = String.fromCharCode(65 + p);
      units.push({ building_id: building.id, floor: f, position, number: `${f}${position}` });
    }
  }
  const { error: unitError } = await supabase.from("units").insert(units);
  if (unitError) return { error: unitError.message };

  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/buildings/${building.id}/invite`);
}

export async function regenerateInvite(buildingId: string) {
  await requireLandlord();
  const supabase = await createClient();
  const code = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  await supabase.from("buildings").update({ invite_code: code }).eq("id", buildingId);
  revalidatePath(`/dashboard/buildings/${buildingId}/invite`);
}

// ---------------------------------------------------------------- broadcasts

export async function sendBroadcast(_: ActionState, form: FormData): Promise<ActionState> {
  const landlord = await requireLandlord();
  const buildingId = String(form.get("building_id") ?? "");
  const text = String(form.get("text") ?? "").trim();
  if (!buildingId) return { error: "Choose a building." };
  if (text.length < 3) return { error: "Write a message first." };
  const supabase = await createClient();
  // RLS checks the building belongs to this landlord.
  const { error } = await supabase.from("broadcasts").insert({ building_id: buildingId, landlord_id: landlord.id, text: text.slice(0, 1000) });
  if (error) return { error: "Couldn't send the message." };
  revalidatePath("/dashboard", "layout");
  return { ok: "Sent to every tenant in the building." };
}

// ---------------------------------------------------------------- tickets

const Classification = z.object({
  issue_type: z.enum(ISSUE_TYPES),
  urgency: z.enum(URGENCIES),
  next_step: z.enum(NEXT_STEPS),
  trade: z.enum(TRADES),
  scope: z.enum(SCOPES),
  summary: z.string().trim().min(3).max(300),
});

/** Landlord edits the classification. A new urgency recalculates the due time. */
export async function updateClassification(ticketId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const { landlord, ticket } = await ownTicket(ticketId);
  const parsed = Classification.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Check the fields and try again." };
  const d = parsed.data;

  const admin = createAdminClient();
  const update: Record<string, unknown> = {
    ...d,
    classified_by: "landlord",
    needs_triage: false,
    landlord_touched: true,
  };
  if (d.urgency !== ticket.urgency || !ticket.due_at) {
    update.due_at = computeDueAt(new Date(ticket.occurred_at), d.urgency, landlord.due_hours as Partial<DueHours>).toISOString();
  }
  await admin.from("tickets").update(update).eq("id", ticketId);
  const changed = Object.fromEntries(
    Object.entries(d).filter(([k, v]) => ticket[k as keyof Ticket] !== v && k !== "summary"),
  );
  await addEvent(admin, ticketId, "reclassified", "landlord", changed);
  revalidatePath(`/dashboard/tickets/${ticketId}`);
  return { ok: "Saved." };
}

export async function postLandlordMessage(ticketId: string, form: FormData) {
  const { landlord } = await ownTicket(ticketId);
  const text = String(form.get("text") ?? "").trim();
  if (!text) return;
  const admin = createAdminClient();
  await addMessage(admin, ticketId, "landlord", text.slice(0, 2000), landlord.name);
  await admin.from("tickets").update({ landlord_touched: true }).eq("id", ticketId);
  revalidatePath(`/dashboard/tickets/${ticketId}`);
}

/** Dismiss a resolved ticket: it leaves the problem list and moves to the archive. */
export async function dismissTicket(ticketId: string) {
  const { ticket } = await ownTicket(ticketId);
  if (ticket.status !== "resolved" && ticket.status !== "dismissed") return;
  const admin = createAdminClient();
  await admin.from("tickets").update({ archived_at: new Date().toISOString() }).eq("id", ticketId);
  await addEvent(admin, ticketId, "archived", "landlord");
  revalidatePath("/dashboard", "layout");
}

// ---------------------------------------------------------------- settings

const STAT_KEYS = ["open", "overdue", "emergencies", "avg_fix_days", "resolved", "needs_triage"] as const;

export async function updateSettings(_: ActionState, form: FormData): Promise<ActionState> {
  const landlord = await requireLandlord();
  const mode = form.get("mode") === "manual" ? "manual" : "automatic";
  const due_hours: Record<string, number> = {};
  for (const u of URGENCIES) {
    const hours = Number(form.get(`due_${u}`));
    if (!Number.isFinite(hours) || hours < 1 || hours > 24 * 90) return { error: "Due times must be between 1 hour and 90 days." };
    due_hours[u] = Math.round(hours);
  }
  const portfolio_stats = STAT_KEYS.filter((k) => form.get(`stat_${k}`) === "on");
  if (!portfolio_stats.length) return { error: "Pick at least one statistic for the problem bar." };

  const supabase = await createClient();
  const { error } = await supabase.from("landlords").update({ mode, due_hours, portfolio_stats }).eq("id", landlord.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard", "layout");
  return { ok: "Settings saved. New due times apply to new tickets." };
}

// ---------------------------------------------------------------- booking (architecture §5.7)

/** "Book now" (emergencies) or the landlord picking a slot: books one of the suggested slots. */
export async function bookTechnician(ticketId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const { ticket } = await ownTicket(ticketId);
  const [technicianId, startsAt, endsAt] = String(form.get("slot") ?? "").split("|");
  if (!technicianId || !startsAt || !endsAt) return { error: "Pick a technician and a time." };
  const admin = createAdminClient();
  // Only technicians this landlord may use: their own or the shared pool.
  const { data: tech } = await admin.from("technicians").select("id, landlord_id").eq("id", technicianId).is("removed_at", null).maybeSingle();
  const landlord = await requireLandlord();
  if (!tech || (tech.landlord_id && tech.landlord_id !== landlord.id)) return { error: "That technician isn't available." };
  const { bookSlot } = await import("@/lib/scheduling");
  const result = await bookSlot(admin, ticket.id, { technicianId, starts_at: startsAt, ends_at: endsAt }, { bookedBy: "landlord" });
  if ("error" in result) return { error: result.error };
  await admin.from("tickets").update({ landlord_touched: true }).eq("id", ticketId);
  revalidatePath(`/dashboard/tickets/${ticketId}`);
  revalidatePath("/dashboard", "layout");
  return { ok: "Booked. The technician and the tenants have been told." };
}

/** Manual mode: confirm the proposed appointment as it is. */
export async function confirmAppointment(ticketId: string, appointmentId: string) {
  await ownTicket(ticketId);
  const admin = createAdminClient();
  const { data: appt } = await admin.from("appointments").select("ticket_id").eq("id", appointmentId).single();
  if (appt?.ticket_id !== ticketId) return;
  const { confirmProposed } = await import("@/lib/scheduling");
  await confirmProposed(admin, appointmentId);
  await admin.from("tickets").update({ landlord_touched: true }).eq("id", ticketId);
  revalidatePath(`/dashboard/tickets/${ticketId}`);
  revalidatePath("/dashboard", "layout");
}

export async function markLandlordNoticeRead(noticeId: string) {
  const landlord = await requireLandlord();
  const admin = createAdminClient();
  await admin.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", noticeId).eq("landlord_id", landlord.id);
  revalidatePath("/dashboard", "layout");
}

// ---------------------------------------------------------------- technicians (architecture §5.8)

const TechnicianForm = z.object({
  name: z.string().trim().min(2, "Enter a name"),
  trade: z.enum(["plumber", "heating", "electrician", "handyman"]),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().min(6, "Enter a phone number"),
});

/** Weekday 2-hour slots, 08:00–18:00, for the next 14 days: a starting point the technician can change. */
async function seedSlots(admin: ReturnType<typeof createAdminClient>, technicianId: string) {
  const { berlinParts, berlinTime } = await import("@/lib/domain");
  const today = berlinParts(new Date());
  const rows: { technician_id: string; starts_at: string; ends_at: string }[] = [];
  for (let d = 1; d <= 14; d++) {
    const day = berlinTime(today.year, today.month, today.day + d, 12);
    const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "Europe/Berlin" }).format(day);
    if (weekday === "Sat" || weekday === "Sun") continue;
    for (const h of [8, 10, 12, 14, 16]) {
      const start = berlinTime(today.year, today.month, today.day + d, h);
      rows.push({ technician_id: technicianId, starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 2 * 36e5).toISOString() });
    }
  }
  await admin.from("tech_slots").insert(rows);
}

export async function addTechnician(_: ActionState, form: FormData): Promise<ActionState> {
  const landlord = await requireLandlord();
  const parsed = TechnicianForm.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("technicians")
    .insert({ ...parsed.data, landlord_id: landlord.id })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not add the technician" };
  const admin = createAdminClient();
  const { data: tech } = await admin.from("technicians").select("id, email, link_token").eq("id", data.id).single();
  if (!tech) return { error: "Could not add the technician" };
  await seedSlots(admin, data.id);
  const { emailTechnician } = await import("@/lib/notify");
  await emailTechnician(admin, tech, {
    kind: "technician_welcome",
    subject: `${landlord.name} added you as a technician on Fixa`,
    text: `Hello ${parsed.data.name.split(" ")[0]},\n\n${landlord.name} will book repair visits with you through Fixa. You don't need an account: your page shows your jobs and lets you set when you're available.`,
  });
  revalidatePath("/dashboard/technicians");
  return { ok: "Added. We've emailed them their link." };
}

export async function updateTechnician(technicianId: string, _: ActionState, form: FormData): Promise<ActionState> {
  await requireLandlord();
  const parsed = TechnicianForm.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  // RLS: only the landlord's own technicians can be updated.
  const { error, count } = await supabase.from("technicians").update(parsed.data, { count: "exact" }).eq("id", technicianId);
  if (error || !count) return { error: error?.message ?? "Could not save" };
  revalidatePath("/dashboard/technicians");
  return { ok: "Saved." };
}

export async function removeTechnician(technicianId: string) {
  await requireLandlord();
  const supabase = await createClient();
  await supabase.from("technicians").update({ removed_at: new Date().toISOString() }).eq("id", technicianId);
  revalidatePath("/dashboard/technicians");
}

export async function resendTechnicianLink(technicianId: string) {
  const landlord = await requireLandlord();
  const admin = createAdminClient();
  const { data } = await admin.from("technicians").select("id, name, email, link_token, landlord_id").eq("id", technicianId).is("removed_at", null).maybeSingle();
  if (!data || data.landlord_id !== landlord.id) return;
  const { emailTechnician } = await import("@/lib/notify");
  await emailTechnician(admin, data, {
    kind: "technician_link",
    subject: "Your Fixa link",
    text: `Hello ${data.name.split(" ")[0]},\n\nHere's your link again, from ${landlord.name}.`,
  });
  revalidatePath("/dashboard/technicians");
}

// ---------------------------------------------------------------- quick-fix guides per building (chatbot)

export async function saveQuickFixGuides(_: ActionState, form: FormData): Promise<ActionState> {
  await requireLandlord();
  const buildingId = String(form.get("building_id") ?? "");
  const guides = String(form.get("guides") ?? "").slice(0, 8000);
  const supabase = await createClient();
  const { error, count } = await supabase.from("buildings").update({ quick_fix_guides: guides }, { count: "exact" }).eq("id", buildingId);
  if (error || !count) return { error: error?.message ?? "Could not save" };
  revalidatePath("/dashboard/settings");
  return { ok: "Guides saved. The chatbot uses them from now on." };
}

// ---------------------------------------------------------------- demo panel (architecture §5.1)

export async function fireDemoEvent(_: ActionState, form: FormData): Promise<ActionState> {
  await requireLandlord();
  if (!demoEnabled()) return { error: "The demo panel is turned off." };
  const unitId = String(form.get("unit_id") ?? "");
  const preset = String(form.get("preset") ?? "") as import("@/lib/sensors").PresetKey;
  const supabase = await createClient();
  // RLS: the unit must be in one of the landlord's buildings.
  const { data: unit } = await supabase.from("units").select("id, number, floor, building_id").eq("id", unitId).maybeSingle();
  if (!unit) return { error: "Pick a flat." };

  const admin = createAdminClient();
  const { fireSensorEvent, PRESETS } = await import("@/lib/sensors");
  const { mergeBuildingHeating } = await import("@/lib/grouping");
  const { processTicket } = await import("@/lib/tickets");

  let fired: string[];
  const toClassify: string[] = [];
  if (preset === "boiler") {
    const { data: floorUnits } = await supabase.from("units").select("id, number").eq("building_id", unit.building_id).eq("floor", unit.floor).order("position");
    for (const u of floorUnits ?? []) await fireSensorEvent(admin, u.id, "cold_room", "boiler");
    fired = (floorUnits ?? []).map((u) => u.number);
  } else if (preset in PRESETS) {
    const { ticketId } = await fireSensorEvent(admin, unit.id, preset as keyof typeof PRESETS);
    if (ticketId) toClassify.push(ticketId);
    fired = [unit.number];
  } else {
    return { error: "Pick a preset." };
  }
  for (const id of toClassify) await processTicket(id);
  if (preset === "boiler" || preset === "cold_room") await mergeBuildingHeating(admin, unit.building_id);

  revalidatePath("/demo");
  revalidatePath("/dashboard", "layout");
  return { ok: `Fired for flat${fired.length > 1 ? "s" : ""} ${fired.join(", ")}.` };
}

export async function runRemindersNow(_: ActionState, form: FormData): Promise<ActionState> {
  await requireLandlord();
  if (!demoEnabled()) return { error: "The demo panel is turned off." };
  const { sendDueReminders } = await import("@/lib/reminders");
  const result = await sendDueReminders(createAdminClient(), { force: form.get("force") === "on" });
  revalidatePath("/demo");
  return { ok: `Sent ${result.sent} reminder${result.sent === 1 ? "" : "s"}.` };
}
