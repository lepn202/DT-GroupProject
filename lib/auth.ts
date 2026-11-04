import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Landlord = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  mode: "automatic" | "manual";
  due_hours: Record<string, number>;
  portfolio_stats: string[];
};

export type TenantContext = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  unit: { id: string; number: string; floor: number; position: string };
  building: { id: string; name: string; address: string };
};

/** The signed-in user's id, verified against the auth server's signing keys. */
export const getUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return (data?.claims?.sub as string | undefined) ?? null;
});

export const getLandlord = cache(async (): Promise<Landlord | null> => {
  const userId = await getUserId();
  if (!userId) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("landlords").select("*").eq("user_id", userId).maybeSingle();
  return data as Landlord | null;
});

export const getTenant = cache(async (): Promise<TenantContext | null> => {
  const userId = await getUserId();
  if (!userId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenants")
    .select("id, user_id, name, email, phone, unit:units(id, number, floor, position, building:buildings(id, name, address))")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  const unit = data.unit as unknown as TenantContext["unit"] & { building: TenantContext["building"] };
  return {
    id: data.id,
    user_id: data.user_id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    unit: { id: unit.id, number: unit.number, floor: unit.floor, position: unit.position },
    building: unit.building,
  };
});

export async function requireLandlord(): Promise<Landlord> {
  const landlord = await getLandlord();
  if (!landlord) redirect("/");
  return landlord;
}

export async function requireTenant(): Promise<TenantContext> {
  const tenant = await getTenant();
  if (!tenant) redirect("/");
  return tenant;
}

/** Where a signed-in user belongs: /dashboard for landlords, /app for tenants. */
export async function homeFor(): Promise<string> {
  if (await getLandlord()) return "/dashboard";
  if (await getTenant()) return "/app";
  return "/login";
}
