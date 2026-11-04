import "server-only";
import { computeDueAt, ticketTitle, type DueHours, type Ticket } from "@/lib/domain";
import { notifyLandlordOfBuilding, notifyTenantsOfUnits } from "@/lib/notify";
import { activeAppointment, bookEarliest } from "@/lib/scheduling";
import { createAdminClient } from "@/lib/supabase/admin";
import { addEvent, addMessage } from "@/lib/tickets";

// Grouping, building-wide tickets and neighbours (architecture §5.5).

type Admin = ReturnType<typeof createAdminClient>;

/** Merge threshold: 3 or more flats with a heating event within 1 hour, at least one confirmed. */
export const MERGE_MIN_FLATS = 3;
const MERGE_WINDOW_MS = 60 * 60 * 1000;

/** Follows parent links to the top ticket. */
async function rootOf(admin: Admin, ticketId: string): Promise<Ticket | null> {
  let id: string | null = ticketId;
  for (let i = 0; i < 5 && id; i++) {
    const res: { data: Ticket | null } = await admin.from("tickets").select("*").eq("id", id).single<Ticket>();
    if (!res.data) return null;
    if (!res.data.parent_ticket_id) return res.data;
    id = res.data.parent_ticket_id;
  }
  return null;
}

/**
 * Tenant reports: when the classifier links a report to an open ticket, the new ticket is
 * attached to it and follows its progress instead of starting its own booking.
 */
export async function attachToRelated(admin: Admin, ticketId: string, relatedId: string) {
  const root = await rootOf(admin, relatedId);
  const { data: ticket } = await admin.from("tickets").select("building_id").eq("id", ticketId).single();
  if (!root || !ticket || root.id === ticketId || root.building_id !== ticket.building_id) return false;
  if (root.status === "resolved" || root.status === "dismissed") return false;

  await admin.from("tickets").update({ parent_ticket_id: root.id, status: root.status }).eq("id", ticketId);
  await addEvent(admin, ticketId, "linked", "ai", { parent: root.id });
  await addEvent(admin, root.id, "report_linked", "ai", { child: ticketId });
  await addMessage(
    admin,
    ticketId,
    "ai",
    `Thanks. This looks like the same problem as one we already know about (${ticketTitle(root)}). We've added your report to it, so you'll see its progress here and don't need to do anything else.`,
  );
  return true;
}

/**
 * Sensor events: 3+ flats in one building with a heating event within 1 hour, and at least one
 * confirmed, become one building-wide ticket (the "boiler ticket"). Flat tickets are attached to it,
 * and one technician visit covers them all. Returns the building ticket's id, if there is one.
 */
export async function mergeBuildingHeating(admin: Admin, buildingId: string): Promise<string | null> {
  const since = new Date(Date.now() - MERGE_WINDOW_MS).toISOString();
  const { data: events } = await admin
    .from("sensor_events")
    .select("id, unit_id, confirmation, ticket_id, reported_at, unit:units!inner(building_id, number, floor)")
    .eq("metric", "temperature")
    .eq("unit.building_id", buildingId)
    .gte("reported_at", since)
    .neq("confirmation", "no");
  const rows = (events ?? []) as unknown as {
    id: string;
    unit_id: string;
    confirmation: string;
    ticket_id: string | null;
    unit: { number: string; floor: number };
  }[];

  // An open building-wide heating ticket picks up any newly confirmed flat ticket.
  const { data: existing } = await admin
    .from("tickets")
    .select("*")
    .eq("building_id", buildingId)
    .eq("scope", "building")
    .eq("issue_type", "heating")
    .is("parent_ticket_id", null)
    .not("status", "in", "(resolved,dismissed)")
    .order("created_at", { ascending: false })
    .limit(1);
  let parent = (existing?.[0] as Ticket | undefined) ?? null;

  const flats = new Set(rows.map((r) => r.unit_id));
  const anyConfirmed = rows.some((r) => r.confirmation === "yes");
  if (!parent && (flats.size < MERGE_MIN_FLATS || !anyConfirmed)) return null;

  const flatNumbers = [...new Map(rows.map((r) => [r.unit_id, r.unit.number])).values()].sort();
  const floors = [...new Set(rows.map((r) => r.unit.floor))];

  if (!parent) {
    const { data: landlord } = await admin.from("buildings").select("landlord:landlords(due_hours)").eq("id", buildingId).single();
    const dueHours = (landlord?.landlord as unknown as { due_hours: Partial<DueHours> } | null)?.due_hours ?? null;
    const now = new Date();
    const { data: created, error } = await admin
      .from("tickets")
      .insert({
        building_id: buildingId,
        unit_id: null,
        scope: "building",
        issue_type: "heating",
        urgency: "high",
        next_step: "schedule_technician",
        trade: "heating",
        summary: `Heating out in ${flatNumbers.length} flats (${flatNumbers.join(", ")})${floors.length === 1 ? ` on floor ${floors[0]}` : ""}: likely the boiler or a shared pipe.`,
        classified_by: "rules",
        status: "logged",
        occurred_at: now.toISOString(),
        due_at: computeDueAt(now, "high", dueHours).toISOString(),
      })
      .select("*")
      .single<Ticket>();
    if (error || !created) throw new Error(error?.message ?? "Could not create the building ticket");
    parent = created;
    await addEvent(admin, parent.id, "grouped", "system", { flats: flatNumbers });
    await notifyLandlordOfBuilding(admin, buildingId, {
      kind: "building_ticket",
      title: `Building-wide heating problem: ${flatNumbers.length} flats`,
      body: parent.summary ?? "",
      link: `/dashboard/tickets/${parent.id}`,
      ticketId: parent.id,
    });
  } else {
    await admin
      .from("tickets")
      .update({ summary: `Heating out in ${flatNumbers.length} flats (${flatNumbers.join(", ")})${floors.length === 1 ? ` on floor ${floors[0]}` : ""}: likely the boiler or a shared pipe.` })
      .eq("id", parent.id)
      .gte("created_at", since);
  }

  // Attach the flat tickets; a visit already booked for one of them becomes the building visit.
  const childIds = rows.map((r) => r.ticket_id).filter((id): id is string => Boolean(id) && id !== parent!.id);
  for (const childId of childIds) {
    const { data: child } = await admin.from("tickets").select("id, parent_ticket_id, status").eq("id", childId).single();
    if (!child || child.parent_ticket_id === parent.id) continue;
    if (child.status === "resolved" || child.status === "dismissed") continue;
    const appt = await activeAppointment(admin, childId);
    if (appt && !(await activeAppointment(admin, parent.id))) {
      await admin.from("appointments").update({ ticket_id: parent.id }).eq("id", appt.id);
      await admin.from("tickets").update({ status: appt.status === "booked" ? "booked" : parent.status }).eq("id", parent.id);
      await addEvent(admin, parent.id, "appointment_moved", "system", { from: childId });
      parent.status = appt.status === "booked" ? "booked" : parent.status;
    } else if (appt) {
      await admin.from("appointments").update({ status: "cancelled" }).eq("id", appt.id);
    }
    await admin.from("tenant_windows").delete().eq("ticket_id", childId);
    await admin.from("tickets").update({ parent_ticket_id: parent.id, status: parent.status, needs_windows: false }).eq("id", childId);
    await addEvent(admin, childId, "linked", "system", { parent: parent.id, building_wide: true });
    await addMessage(
      admin,
      childId,
      "ai",
      "Several flats in your building have the same heating problem, so we've merged them into one building-wide ticket. One technician visit covers everyone; you'll see its progress here and on your Home screen.",
    );
  }

  // One visit for the whole building: book it if there isn't one yet.
  if (!(await activeAppointment(admin, parent.id))) await bookEarliest(admin, parent.id);
  return parent.id;
}

/**
 * Neighbours below: for a water ticket, the flat one floor down in the same position
 * (2B → 1B) is told straight away.
 */
export async function warnFlatBelow(admin: Admin, ticket: Pick<Ticket, "id" | "unit_id" | "building_id" | "issue_type" | "scope">) {
  if (ticket.issue_type !== "water" || ticket.scope !== "apartment" || !ticket.unit_id) return;
  const { data: unit } = await admin.from("units").select("floor, position, number").eq("id", ticket.unit_id).single();
  if (!unit || unit.floor <= 1) return;
  const { data: below } = await admin
    .from("units")
    .select("id, number")
    .eq("building_id", ticket.building_id)
    .eq("floor", unit.floor - 1)
    .eq("position", unit.position)
    .maybeSingle();
  if (!below) return;
  await notifyTenantsOfUnits(
    admin,
    [below.id],
    {
      kind: "neighbour_leak",
      title: "Water leak reported in the flat above",
      body: "Check your ceiling and tell us if you see water. A photo is enough.",
      link: "/app/new",
    },
    { email: true },
  );
  await addEvent(admin, ticket.id, "neighbour_notified", "system", { flat: below.number });
}
