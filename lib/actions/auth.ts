"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { homeFor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string } | undefined;

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(form.get("email") ?? "").trim(),
    password: String(form.get("password") ?? ""),
  });
  if (error) return { error: "That email and password don't match. Try again." };
  redirect(await homeFor());
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const LandlordSignUp = z.object({
  name: z.string().trim().min(2, "Enter your name"),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters for the password"),
});

/** Landlord sign-up. The account gets a licence flag (no payment in the MVP). */
export async function signUpLandlord(_: FormState, form: FormData): Promise<FormState> {
  const parsed = LandlordSignUp.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email: parsed.data.email, password: parsed.data.password });
  if (error || !data.user) return { error: error?.message ?? "Could not create the account" };
  if (!data.session) return { error: "Check your inbox to confirm your email, then sign in." };

  const { error: insertError } = await supabase
    .from("landlords")
    .insert({ user_id: data.user.id, name: parsed.data.name, email: parsed.data.email });
  if (insertError) return { error: insertError.message };
  redirect("/dashboard/buildings/new");
}

const TenantSignUp = z.object({
  code: z.string().min(4),
  unit: z.uuid("Pick your apartment"),
  name: z.string().trim().min(2, "Enter your name"),
  email: z.email("Enter a valid email"),
  phone: z.string().trim().min(6, "Enter your phone number"),
  password: z.string().min(8, "Use at least 8 characters for the password"),
});

/** Tenant sign-up from an invite link: ties the account to one apartment (architecture §5.9). */
export async function joinBuilding(_: FormState, form: FormData): Promise<FormState> {
  const parsed = TenantSignUp.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email: d.email, password: d.password });
  if (error || !data.user) return { error: error?.message ?? "Could not create the account" };
  if (!data.session) return { error: "Check your inbox to confirm your email, then open the invite link again." };

  const { error: joinError } = await supabase.rpc("join_building", {
    code: d.code,
    unit: d.unit,
    tenant_name: d.name,
    tenant_phone: d.phone,
  });
  if (joinError) return { error: joinError.message };
  redirect("/app");
}
