"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireLandlord } from "@/lib/auth";
import { computeDueAt, ISSUE_TYPES, NEXT_STEPS, SCOPES, TRADES, URGENCIES, type DueHours, type Ticket } from "@/lib/domain";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { addEvent, addMessage } from "@/lib/tickets";

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
