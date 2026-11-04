"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenant } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { addEvent, addMessage, createTenantReport, processTicket } from "@/lib/tickets";

const Report = z.object({
  text: z.string().trim().max(2000).nullable(),
  transcript: z.string().trim().max(4000).nullable(),
  mediaPaths: z.array(z.string()).max(6),
  framePaths: z.array(z.string()).max(8),
});

export type SubmitResult = { ticketId: string } | { error: string };

/**
 * Add ticket: the tenant sees "Received, we're on it" straight away; classification runs
 * after the response (architecture §5.3) and the result arrives over Realtime.
 */
export async function submitReport(input: z.infer<typeof Report>): Promise<SubmitResult> {
  const tenant = await requireTenant();
  const parsed = Report.safeParse(input);
  if (!parsed.success) return { error: "Something in the report wasn't valid. Try again." };
  const d = parsed.data;
  if (!d.text && !d.transcript && !d.mediaPaths.length) return { error: "Add a photo, video, voice memo or a few words." };

  // Media must be in the tenant's own upload folder.
  const ownFolder = `${tenant.user_id}/`;
  if ([...d.mediaPaths, ...d.framePaths].some((p) => !p.startsWith(ownFolder))) return { error: "Upload failed. Try again." };

  const ticketId = await createTenantReport({
    tenantId: tenant.id,
    unitId: tenant.unit.id,
    buildingId: tenant.building.id,
    text: d.text || null,
    transcript: d.transcript || null,
    mediaPaths: d.mediaPaths,
    framePaths: d.framePaths,
  });

  after(async () => {
    try {
      await processTicket(ticketId);
    } catch (err) {
      console.error("processTicket failed", err);
      const admin = createAdminClient();
      await admin.from("tickets").update({ needs_triage: true }).eq("id", ticketId);
    }
  });

  revalidatePath("/app");
  return { ticketId };
}

async function assertTenantTicket(ticketId: string) {
  const tenant = await requireTenant();
  const supabase = await createClient();
  const { data } = await supabase.from("tickets").select("id, status, next_step, unit_id").eq("id", ticketId).maybeSingle();
  if (!data) throw new Error("Ticket not found");
  return { tenant, ticket: data };
}

export async function postTenantMessage(ticketId: string, form: FormData) {
  const text = String(form.get("text") ?? "").trim();
  if (!text) return;
  const { tenant } = await assertTenantTicket(ticketId);
  const admin = createAdminClient();
  await addMessage(admin, ticketId, "tenant", text.slice(0, 2000), tenant.name);
  revalidatePath(`/app/tickets/${ticketId}`);
}

/** Quick fix outcome: "Fixed it" closes the ticket, "Didn't work" switches to scheduling. */
export async function quickFixOutcome(ticketId: string, worked: boolean) {
  const { tenant, ticket } = await assertTenantTicket(ticketId);
  if (ticket.status !== "quick_fix" || ticket.unit_id !== tenant.unit.id) return;
  const admin = createAdminClient();
  if (worked) {
    await admin.from("tickets").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", ticketId);
    await addEvent(admin, ticketId, "status", "tenant", { status: "resolved", via: "quick_fix" });
    await addMessage(admin, ticketId, "ai", "Great, glad that worked. We've closed this ticket. It's in your History.");
  } else {
    const { data: t } = await admin.from("tickets").select("issue_type").eq("id", ticketId).single();
    const trade = t?.issue_type === "water" ? "plumber" : t?.issue_type === "heating" ? "heating" : t?.issue_type === "electricity" ? "electrician" : "handyman";
    await admin.from("tickets").update({ status: "logged", next_step: "schedule_technician", trade }).eq("id", ticketId);
    await addEvent(admin, ticketId, "escalated", "tenant", { from: "quick_fix", to: "schedule_technician" });
    await addMessage(admin, ticketId, "ai", "Sorry it didn't work. We'll send a technician; we'll ask when you're home so we can book one.");
  }
  revalidatePath(`/app/tickets/${ticketId}`);
  revalidatePath("/app");
}

const Profile = z.object({
  name: z.string().trim().min(2),
  phone: z.string().trim().min(6),
});

export type ProfileState = { error?: string; ok?: string } | undefined;

export async function updateProfile(_: ProfileState, form: FormData): Promise<ProfileState> {
  const tenant = await requireTenant();
  const parsed = Profile.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter your name and a phone number." };
  const supabase = await createClient();
  const { error } = await supabase.from("tenants").update(parsed.data).eq("id", tenant.id);
  if (error) return { error: error.message };
  revalidatePath("/app/profile");
  return { ok: "Saved." };
}

export async function changePassword(_: ProfileState, form: FormData): Promise<ProfileState> {
  await requireTenant();
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { error: "Use at least 8 characters." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  return { ok: "Password changed." };
}
