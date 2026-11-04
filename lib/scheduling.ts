import "server-only";
import { formatSlot, TRADE_LABEL, tradeFor, type Ticket, type Trade } from "@/lib/domain";
import { emailTechnician, notifyLandlordOfBuilding, notifyTenantsOfUnits } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { addEvent, addMessage, setStatus } from "@/lib/tickets";

// Matching and booking (architecture §5.7). Plain code, no AI.

type Admin = ReturnType<typeof createAdminClient>;
type TechTrade = Exclude<Trade, "none">;

export type Technician = { id: string; landlord_id: string | null; name: string; trade: TechTrade; email: string; phone: string; link_token: string };
export type FreeSlot = { technician: Technician; starts_at: string; ends_at: string; custom: boolean };

const ACTIVE = ["proposed", "booked"];

/** The landlord's own technicians for a trade first, then the shared pool. */
export async function technicianGroups(admin: Admin, landlordId: string, trade: TechTrade) {
  const { data } = await admin
    .from("technicians")
    .select("id, landlord_id, name, trade, email, phone, link_token")
    .eq("trade", trade)
    .is("removed_at", null)
    .or(`landlord_id.eq.${landlordId},landlord_id.is.null`)
    .order("name");
  const techs = (data ?? []) as Technician[];
  return { custom: techs.filter((t) => t.landlord_id === landlordId), pool: techs.filter((t) => t.landlord_id === null) };
}

/** Free slots of these technicians from `from` on: offered slots minus ones already taken. */
export async function freeSlots(admin: Admin, techs: Technician[], from: Date, until?: Date): Promise<FreeSlot[]> {
  if (!techs.length) return [];
  const ids = techs.map((t) => t.id);
  let q = admin.from("tech_slots").select("technician_id, starts_at, ends_at").in("technician_id", ids).gte("starts_at", from.toISOString()).order("starts_at");
  if (until) q = q.lte("starts_at", until.toISOString());
  const [{ data: slots }, { data: taken }] = await Promise.all([
    q,
    admin.from("appointments").select("technician_id, starts_at, ends_at").in("technician_id", ids).in("status", ACTIVE).gte("ends_at", from.toISOString()),
  ]);
  const byId = new Map(techs.map((t) => [t.id, t]));
  return (slots ?? [])
    .filter(
      (s) =>
        !(taken ?? []).some(
          (a) => a.technician_id === s.technician_id && new Date(a.starts_at) < new Date(s.ends_at) && new Date(a.ends_at) > new Date(s.starts_at),
        ),
    )
    .map((s) => {
      const technician = byId.get(s.technician_id)!;
      return { technician, starts_at: s.starts_at, ends_at: s.ends_at, custom: technician.landlord_id !== null };
    });
}

/** Earliest technician slot that fits inside one of the tenant's windows. Custom technicians first, then the pool. */
export async function findMatch(admin: Admin, landlordId: string, trade: TechTrade, windows: { starts_at: string; ends_at: string }[]) {
  if (!windows.length) return null;
  const { custom, pool } = await technicianGroups(admin, landlordId, trade);
  const now = new Date();
  for (const group of [custom, pool]) {
    const slots = await freeSlots(admin, group, now);
    const fit = slots.find((s) =>
      windows.some((w) => new Date(s.starts_at) >= new Date(w.starts_at) && new Date(s.ends_at) <= new Date(w.ends_at)),
    );
    if (fit) return fit;
  }
  return null;
}

/** Options for the landlord's "Book now" picker: the next free slots, custom technicians first. */
export async function suggestSlots(admin: Admin, landlordId: string, trade: TechTrade, limit = 8) {
  const { custom, pool } = await technicianGroups(admin, landlordId, trade);
  const now = new Date();
  const [c, p] = await Promise.all([freeSlots(admin, custom, now), freeSlots(admin, pool, now)]);
  return [...c.slice(0, Math.ceil(limit / 2)), ...p].slice(0, limit);
}

export function ticketTrade(t: Pick<Ticket, "trade" | "issue_type">): TechTrade {
  return t.trade && t.trade !== "none" ? t.trade : tradeFor(t.issue_type);
}

/** Flats a ticket covers: its own, or every grouped flat for a building-wide ticket. */
export async function affectedUnits(admin: Admin, ticket: Pick<Ticket, "id" | "unit_id">) {
  const { data: children } = await admin.from("tickets").select("unit_id").eq("parent_ticket_id", ticket.id);
  const ids = new Set<string>();
  if (ticket.unit_id) ids.add(ticket.unit_id);
  for (const c of children ?? []) if (c.unit_id) ids.add(c.unit_id);
  return [...ids];
}

async function loadTicket(admin: Admin, ticketId: string) {
  const { data } = await admin
    .from("tickets")
    .select("*, building:buildings(id, name, address, landlord:landlords(id, mode)), unit:units(number, floor)")
    .eq("id", ticketId)
    .single();
  return data as
    | (Ticket & {
        building: { id: string; name: string; address: string; landlord: { id: string; mode: "automatic" | "manual" } };
        unit: { number: string; floor: number } | null;
      })
    | null;
}

export async function activeAppointment(admin: Admin, ticketId: string) {
  const { data } = await admin.from("appointments").select("*").eq("ticket_id", ticketId).in("status", ACTIVE).order("created_at", { ascending: false }).limit(1);
  return data?.[0] ?? null;
}

/**
 * Books (or proposes) a technician slot for a ticket. Booking tells the technician by email,
 * every tenant of the affected flats in-app (roommates and, for building-wide tickets, every
 * affected flat), and moves the ticket to "booked".
 */
export async function bookSlot(
  admin: Admin,
  ticketId: string,
  slot: { technicianId: string; starts_at: string; ends_at: string },
  opts: { bookedBy: "system" | "landlord"; propose?: boolean },
): Promise<{ ok: true; appointmentId: string } | { error: string }> {
  const ticket = await loadTicket(admin, ticketId);
  if (!ticket) return { error: "Ticket not found" };

  // The slot may have gone in the meantime.
  const { data: clash } = await admin
    .from("appointments")
    .select("id")
    .eq("technician_id", slot.technicianId)
    .in("status", ACTIVE)
    .lt("starts_at", slot.ends_at)
    .gt("ends_at", slot.starts_at)
    .limit(1);
  if (clash?.length) return { error: "That slot was just taken. Pick another one." };

  // One active appointment per ticket: a new booking replaces a proposal.
  await admin.from("appointments").update({ status: "cancelled" }).eq("ticket_id", ticketId).in("status", ACTIVE);

  const status = opts.propose ? "proposed" : "booked";
  const { data: appt, error } = await admin
    .from("appointments")
    .insert({ ticket_id: ticketId, technician_id: slot.technicianId, starts_at: slot.starts_at, ends_at: slot.ends_at, booked_by: opts.bookedBy, status })
    .select("id")
    .single();
  if (error || !appt) return { error: error?.message ?? "Could not book" };

  if (opts.propose) {
    await admin.from("tickets").update({ needs_windows: false }).eq("id", ticketId);
    const { data: tech } = await admin.from("technicians").select("name").eq("id", slot.technicianId).single();
    await addEvent(admin, ticketId, "proposed", "system", { technician: tech?.name, starts_at: slot.starts_at });
    await notifyLandlordOfBuilding(admin, ticket.building.id, {
      kind: "confirm_booking",
      title: `Confirm a booking: ${tech?.name ?? "technician"}, ${formatSlot(slot.starts_at, slot.ends_at)}`,
      body: `${ticket.summary ?? "A ticket"} (${ticket.unit ? `flat ${ticket.unit.number}` : "whole building"}, ${ticket.building.name}). Manual mode: nothing goes out until you confirm.`,
      link: `/dashboard/tickets/${ticketId}`,
      ticketId,
    });
    await addMessage(admin, ticketId, "ai", `We've found a time that fits: ${formatSlot(slot.starts_at, slot.ends_at)}. Your landlord is confirming it; we'll tell you as soon as it's booked.`);
    return { ok: true, appointmentId: appt.id };
  }

  await announceBooking(admin, ticket, appt.id);
  return { ok: true, appointmentId: appt.id };
}

/** Manual mode: the landlord confirms a proposed appointment. */
export async function confirmProposed(admin: Admin, appointmentId: string) {
  const { data: appt } = await admin.from("appointments").select("id, ticket_id, status").eq("id", appointmentId).single();
  if (!appt || appt.status !== "proposed") return;
  await admin.from("appointments").update({ status: "booked", booked_by: "landlord" }).eq("id", appointmentId);
  const ticket = await loadTicket(admin, appt.ticket_id);
  if (ticket) await announceBooking(admin, ticket, appointmentId);
}

async function announceBooking(admin: Admin, ticket: NonNullable<Awaited<ReturnType<typeof loadTicket>>>, appointmentId: string) {
  const { data: appt } = await admin
    .from("appointments")
    .select("starts_at, ends_at, technician:technicians(id, name, trade, email, phone, link_token)")
    .eq("id", appointmentId)
    .single();
  if (!appt) return;
  const tech = appt.technician as unknown as Technician;
  const when = formatSlot(appt.starts_at, appt.ends_at);
  const trade = TRADE_LABEL[tech.trade].toLowerCase();
  const where = ticket.scope === "building" ? `${ticket.building.name} (whole building)` : `${ticket.building.name}, flat ${ticket.unit?.number ?? "?"}`;

  await setStatus(admin, ticket.id, "booked", "system", { technician: tech.name, starts_at: appt.starts_at }, { needs_windows: false });

  const units = await affectedUnits(admin, ticket);
  await notifyTenantsOfUnits(
    admin,
    units,
    {
      kind: "booked",
      title: `${tech.name.split(" (")[0]} (${trade}) is coming ${when}`,
      body: ticket.scope === "building" ? `For the building-wide ${ticket.issue_type ?? ""} problem. One visit covers every affected flat.` : (ticket.summary ?? ""),
      link: ticket.unit_id ? `/app/tickets/${ticket.id}` : "/app",
      ticketId: ticket.id,
    },
    { email: true },
  );
  await addMessage(admin, ticket.id, "ai", `Booked: ${tech.name} (${trade}), ${when}. We'll remind you the evening before and an hour before.`);

  // Technician email: job, location, slot and the link page. Minimum contact details (architecture §11).
  const { data: contact } = ticket.unit_id
    ? await admin.from("tenants").select("name, phone").eq("unit_id", ticket.unit_id).limit(1)
    : { data: [] as { name: string; phone: string }[] };
  const first = contact?.[0];
  await emailTechnician(admin, tech, {
    kind: "technician_booking",
    subject: `New job: ${ticket.summary ?? ticket.issue_type ?? "repair"}, ${when}`,
    text: [
      `Hello ${tech.name.split(" ")[0]},`,
      ``,
      `You've been booked for ${when}.`,
      `Where: ${where}, ${ticket.building.address}`,
      `What: ${ticket.summary ?? "See the photos on your page."}`,
      first ? `Tenant: ${first.name.split(" ")[0]}, ${first.phone}` : "",
      ``,
      `Tap Confirmed, Running late, On site or Done on your page as the job goes.`,
    ]
      .filter((l) => l !== "")
      .join("\n"),
    ticketId: ticket.id,
  });
}

/**
 * Tenant availability → earliest overlap → booked (automatic) or proposed (manual).
 * No overlap: the tenant is asked for more times and the ticket is flagged on the dashboard.
 */
export async function matchAndBook(admin: Admin, ticketId: string) {
  const ticket = await loadTicket(admin, ticketId);
  if (!ticket) return { status: "missing" as const };
  const { data: windows } = await admin.from("tenant_windows").select("starts_at, ends_at").eq("ticket_id", ticketId);
  const slot = await findMatch(admin, ticket.building.landlord.id, ticketTrade(ticket), windows ?? []);
  if (!slot) {
    await admin.from("tickets").update({ needs_windows: true }).eq("id", ticketId);
    await addEvent(admin, ticketId, "no_overlap", "system", { windows: windows?.length ?? 0 });
    await addMessage(admin, ticketId, "ai", "No technician is free at those times yet. Could you add a few more times when you're home?");
    return { status: "no_overlap" as const };
  }
  const manual = ticket.building.landlord.mode === "manual";
  await bookSlot(admin, ticketId, { technicianId: slot.technician.id, starts_at: slot.starts_at, ends_at: slot.ends_at }, { bookedBy: "system", propose: manual });
  return { status: manual ? ("proposed" as const) : ("booked" as const), slot };
}

/** Building-wide tickets don't need tenant windows (the boiler is in the cellar): book the earliest free slot. */
export async function bookEarliest(admin: Admin, ticketId: string) {
  const ticket = await loadTicket(admin, ticketId);
  if (!ticket || (await activeAppointment(admin, ticketId))) return null;
  const [slot] = await suggestSlots(admin, ticket.building.landlord.id, ticketTrade(ticket), 1);
  if (!slot) return null;
  return bookSlot(
    admin,
    ticketId,
    { technicianId: slot.technician.id, starts_at: slot.starts_at, ends_at: slot.ends_at },
    { bookedBy: "system", propose: ticket.building.landlord.mode === "manual" },
  );
}

/** Frees a booked slot: the appointment is cancelled, the technician told, the tenant asked for new times. */
export async function cancelForReschedule(admin: Admin, appointmentId: string, reason: string) {
  const { data: appt } = await admin
    .from("appointments")
    .select("id, ticket_id, starts_at, ends_at, status, technician:technicians(id, name, email, link_token)")
    .eq("id", appointmentId)
    .single();
  if (!appt || !ACTIVE.includes(appt.status)) return;
  await admin.from("appointments").update({ status: "cancelled" }).eq("id", appointmentId);
  await admin.from("tenant_windows").delete().eq("ticket_id", appt.ticket_id);
  await setStatus(admin, appt.ticket_id, "logged", "tenant", { reason }, { needs_windows: false });
  const tech = appt.technician as unknown as { id: string; name: string; email: string; link_token: string };
  await emailTechnician(admin, tech, {
    kind: "technician_cancelled",
    subject: `Cancelled: ${formatSlot(appt.starts_at, appt.ends_at)}`,
    text: `Hello ${tech.name.split(" ")[0]},\n\nThe visit on ${formatSlot(appt.starts_at, appt.ends_at)} is cancelled (${reason}). The slot is free again.`,
    ticketId: appt.ticket_id,
  });
}
