import "server-only";
import type { Ticket } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import type { TenantContext } from "@/lib/auth";

/** Tickets the tenant can see: their flat's, plus building-wide ones (RLS enforces the same). */
export async function tenantTickets(tenant: TenantContext) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tickets")
    .select("*")
    .or(`unit_id.eq.${tenant.unit.id},and(scope.eq.building,building_id.eq.${tenant.building.id})`)
    .order("created_at", { ascending: false });
  return (data ?? []) as Ticket[];
}

export async function latestBroadcasts(buildingId: string, limit = 20) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("broadcasts")
    .select("id, text, created_at")
    .eq("building_id", buildingId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
