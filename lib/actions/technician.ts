"use server";

import { revalidatePath } from "next/cache";
import { berlinParts, berlinTime, formatSlot } from "@/lib/domain";
import { notifyLandlordOfBuilding, notifyTenantsOfUnits } from "@/lib/notify";
import { affectedUnits, bookEarliest } from "@/lib/scheduling";
import { createAdminClient } from "@/lib/supabase/admin";
import { addEvent, addMessage, setStatus } from "@/lib/tickets";

// Technician link page (/t/[token], architecture §5.7). Technicians have no accounts: every
// action is authorised by the long random token in their link, and only touches their own jobs.

async function techByToken(token: string) {
  if (!/^[a-f0-9]{48}$/.test(token)) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("technicians").select("id, name").eq("link_token", token).is("removed_at", null).maybeSingle();
  return data ? { admin, tech: data } : null;
}

async function ownAppointment(token: string, appointmentId: string) {
  const ctx = await techByToken(token);
  if (!ctx) return null;
  const { data: appt } = await ctx.admin
    .from("appointments")
    .select("id, ticket_id, starts_at, ends_at, status, technician_id, ticket:tickets(id, unit_id, building_id, scope, summary, status)")
    .eq("id", appointmentId)
    .eq("technician_id", ctx.tech.id)
    .maybeSingle();
  if (!appt) return null;
  return { ...ctx, appt, ticket: appt.ticket as unknown as { id: string; unit_id: string | null; building_id: string; scope: string; summary: string | null; status: string } };
}

const STATUS_TEXT = {
  confirmed: (slot: string) => `Confirmed: I'll be there ${slot}.`,
  late: () => "Running about 15 minutes late, sorry.",
  on_site: () => "I'm on site now.",
} as const;

/** Confirmed / Running late / On site: each tap posts to the tenant's Messages and updates the ticket. */
export async function setVisitStatus(token: string, appointmentId: string, status: keyof typeof STATUS_TEXT) {
  const ctx = await ownAppointment(token, appointmentId);
  if (!ctx || ctx.appt.status !== "booked") return;
  const { admin, appt, ticket, tech } = ctx;
  await admin.from("appointments").update({ technician_status: status }).eq("id", appointmentId);
  await addMessage(admin, ticket.id, "technician", STATUS_TEXT[status](formatSlot(appt.starts_at, appt.ends_at)), tech.name);
  if (status === "on_site") {
    await setStatus(admin, ticket.id, "in_progress", "technician", { technician: tech.name });
  } else {
    await addEvent(admin, ticket.id, `technician_${status}`, "technician", { technician: tech.name });
  }
  if (status === "late") {
    await notifyTenantsOfUnits(admin, await affectedUnits(admin, ticket), {
      kind: "technician_late",
      title: `${tech.name.split(" (")[0]} is running about 15 minutes late`,
      link: ticket.unit_id ? `/app/tickets/${ticket.id}` : "/app",
      ticketId: ticket.id,
    });
  }
  revalidatePath(`/t/${token}`);
}

/**
 * "Done" with an outcome (architecture §5.7, visit outcomes):
 *   completed       → ticket resolved
 *   needs_follow_up → back to stage 1; the tenant picks new times
 *   no_access       → same, and it counts as a missed appointment
 */
export async function finishVisit(token: string, appointmentId: string, form: FormData) {
  const outcome = String(form.get("outcome") ?? "");
  if (!["completed", "needs_follow_up", "no_access"].includes(outcome)) return;
  const note = String(form.get("note") ?? "").trim().slice(0, 500) || null;
  const ctx = await ownAppointment(token, appointmentId);
  if (!ctx || ctx.appt.status !== "booked") return;
  const { admin, ticket, tech } = ctx;

  await admin.from("appointments").update({ status: "done", outcome, outcome_note: note }).eq("id", appointmentId);
  const units = await affectedUnits(admin, ticket);
  const link = ticket.unit_id ? `/app/tickets/${ticket.id}` : "/app";

  if (outcome === "completed") {
    await setStatus(admin, ticket.id, "resolved", "technician", { outcome, technician: tech.name });
    await addMessage(admin, ticket.id, "technician", `Done: the repair is finished.${note ? ` ${note}` : ""}`, tech.name);
    await notifyTenantsOfUnits(admin, units, { kind: "resolved", title: "Fixed: your repair is done", body: ticket.summary ?? "", link, ticketId: ticket.id });
  } else {
    await setStatus(admin, ticket.id, "logged", "technician", { outcome, technician: tech.name }, { needs_windows: false });
    await admin.from("tenant_windows").delete().eq("ticket_id", ticket.id);
    const why = outcome === "no_access" ? "Nobody could let me in." : "This needs a second visit (parts or more work).";
    await addMessage(admin, ticket.id, "technician", `${why}${note ? ` ${note}` : ""}`, tech.name);
    if (ticket.scope === "building") {
      // No tenant windows for the building: book the next visit straight away.
      await addMessage(admin, ticket.id, "ai", "We're booking the next visit for the building now.");
      await bookEarliest(admin, ticket.id);
    } else {
      await addMessage(
        admin,
        ticket.id,
        "ai",
        outcome === "no_access"
          ? "The technician couldn't get in. When are you home? Pick a few times below and we'll book again."
          : "The technician needs to come back. Pick a few times when you're home and we'll book the next visit.",
      );
      await notifyTenantsOfUnits(
        admin,
        units,
        {
          kind: outcome,
          title: outcome === "no_access" ? "The technician couldn't get in" : "A second visit is needed",
          body: "Pick new times when you're home.",
          link,
          ticketId: ticket.id,
        },
        { email: true },
      );
    }
    if (outcome === "no_access") {
      await notifyLandlordOfBuilding(admin, ticket.building_id, {
        kind: "missed_appointment",
        title: "Missed appointment: no access",
        body: ticket.summary ?? "",
        link: `/dashboard/tickets/${ticket.id}`,
        ticketId: ticket.id,
      });
    }
  }
  revalidatePath(`/t/${token}`);
}

/** Availability: toggles one 2-hour slot (08:00–18:00, next 14 days). Booked slots can't be removed here. */
export async function toggleSlot(token: string, startsAt: string) {
  const ctx = await techByToken(token);
  if (!ctx) return;
  const start = new Date(startsAt);
  const now = new Date();
  if (Number.isNaN(start.getTime()) || start < now || start.getTime() > now.getTime() + 15 * 864e5) return;
  const { hour } = berlinParts(start);
  if (hour < 8 || hour > 16 || hour % 2 !== 0) return;
  const d = berlinParts(start);
  const normalised = berlinTime(d.year, d.month, d.day, hour).toISOString();
  const end = new Date(new Date(normalised).getTime() + 2 * 36e5).toISOString();

  const { admin, tech } = ctx;
  const { data: existing } = await admin.from("tech_slots").select("id").eq("technician_id", tech.id).eq("starts_at", normalised);
  if (existing?.length) {
    const { data: booked } = await admin
      .from("appointments")
      .select("id")
      .eq("technician_id", tech.id)
      .in("status", ["proposed", "booked"])
      .lt("starts_at", end)
      .gt("ends_at", normalised)
      .limit(1);
    if (booked?.length) return;
    await admin.from("tech_slots").delete().in("id", existing.map((s) => s.id));
  } else {
    await admin.from("tech_slots").insert({ technician_id: tech.id, starts_at: normalised, ends_at: end });
  }
  revalidatePath(`/t/${token}`);
}
