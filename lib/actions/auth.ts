"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { homeFor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; notice?: string } | undefined;

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(form.get("email") ?? "").trim(),
    password: String(form.get("password") ?? ""),
  });
  if (error) {
    if (error.code === "email_not_confirmed") return { error: "Confirm your email first: open the link we sent you, then sign in." };
    return { error: "That email and password don't match. Try again." };
  }
  const home = await homeFor();
  // Signed in, but no landlord or tenant record yet: finish setting up.
  redirect(home === "/login" ? "/welcome" : home);
}

/** Where the confirmation email's link should land, on whichever host this runs (localhost, Vercel). */
async function confirmUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") || host?.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}/auth/confirm`;
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
  // The landlord record is created by a database trigger from this metadata
  // (supabase/migrations/20261105000000_profile_on_signup.sql), so it exists even
  // when the account has to confirm its email before the first sign-in.
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { role: "landlord", name: parsed.data.name }, emailRedirectTo: await confirmUrl() },
  });
  if (error || !data.user) return { error: error?.message ?? "Could not create the account" };
  if (!data.session) return { notice: "Almost done: open the link we emailed you to confirm your address. It signs you in." };
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
  // The tenant record is created by a database trigger from this metadata, which also
  // checks the flat belongs to the invite code's building.
  const { data, error } = await supabase.auth.signUp({
    email: d.email,
    password: d.password,
    options: {
      data: { role: "tenant", invite_code: d.code, unit_id: d.unit, name: d.name, phone: d.phone },
      emailRedirectTo: await confirmUrl(),
    },
  });
  if (error || !data.user) {
    return { error: error?.message?.includes("Database error") ? "That invite code or flat isn't valid any more. Ask your landlord for a new link." : (error?.message ?? "Could not create the account") };
  }
  if (!data.session) return { notice: "Almost done: open the link we emailed you to confirm your address. It signs you in." };
  redirect("/app");
}

const Welcome = z.object({ name: z.string().trim().min(2, "Enter your name") });

/** For a signed-in user with no landlord or tenant record (e.g. signed up before the trigger existed). */
export async function finishLandlordSetup(_: FormState, form: FormData): Promise<FormState> {
  const parsed = Welcome.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const { error } = await supabase
    .from("landlords")
    .insert({ user_id: data.user.id, name: parsed.data.name, email: data.user.email ?? "" });
  if (error) return { error: "Couldn't finish setting up your account. Try again." };
  redirect("/dashboard/buildings/new");
}
