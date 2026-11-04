import "server-only";
import { isOpen, type Ticket } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";

export type BuildingRow = { id: string; name: string; address: string; invite_code: string; units: number };

export async function landlordBuildings(): Promise<BuildingRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("buildings").select("id, name, address, invite_code, units(count)").order("name");
  return (data ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    address: b.address,
    invite_code: b.invite_code,
    units: (b.units as unknown as { count: number }[])[0]?.count ?? 0,
  }));
}

/** Tickets on the dashboard: everything not yet archived (resolved ones stay until dismissed). */
export async function landlordTickets(buildingId?: string) {
  const supabase = await createClient();
  let q = supabase.from("tickets").select("*, unit:units(number)").is("archived_at", null);
  if (buildingId) q = q.eq("building_id", buildingId);
  const { data } = await q;
  return (data ?? []) as (Ticket & { unit: { number: string } | null })[];
}

export type Kpis = {
  medianFixDays: number | null;
  open: number;
  resolved: number;
  overdue: number;
  emergencies: number;
  needsTriage: number;
  handledWithoutLandlord: number | null;
  stages: { logged: number; booked: number; inProgress: number; resolved: number };
};

function median(values: number[]) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * KPI bar (architecture §5.8). Main KPI: time from issue to fix, resolved_at − occurred_at,
 * median over tickets resolved in the last 30 days.
 */
export function computeKpis(tickets: Ticket[], now = new Date()): Kpis {
  const monthAgo = now.getTime() - 30 * 864e5;
  const fixed = tickets.filter((t) => t.resolved_at && new Date(t.resolved_at).getTime() >= monthAgo);
  const fixDays = fixed.map((t) => (new Date(t.resolved_at!).getTime() - new Date(t.occurred_at).getTime()) / 864e5);
  const open = tickets.filter(isOpen);
  const classified = tickets.filter((t) => t.classified_by && t.status !== "dismissed");
  return {
    medianFixDays: median(fixDays),
    open: open.length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
    overdue: open.filter((t) => t.due_at && new Date(t.due_at) < now).length,
    emergencies: open.filter((t) => t.urgency === "emergency").length,
    needsTriage: open.filter((t) => t.needs_triage).length,
    handledWithoutLandlord: classified.length
      ? Math.round((classified.filter((t) => !t.landlord_touched).length / classified.length) * 100)
      : null,
    stages: {
      logged: tickets.filter((t) => ["logged", "confirmed", "quick_fix"].includes(t.status)).length,
      booked: tickets.filter((t) => t.status === "booked").length,
      inProgress: tickets.filter((t) => t.status === "in_progress").length,
      resolved: tickets.filter((t) => t.status === "resolved").length,
    },
  };
}
