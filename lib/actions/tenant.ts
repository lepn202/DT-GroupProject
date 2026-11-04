"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTenant } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { addEvent, addMessage, applyQuickFixOutcome, createTenantReport, processTicket } from "@/lib/tickets";

const Report = z.object({
  text: z.string().trim().max(2000).nullable(),
  transcript: z.string().trim().max(4000).nullable(),
  mediaPaths: z.array(z.string()).max(6),
  framePaths: z.array(z.string()).max(8),
  /** "Add photo" on a sensor prompt: the photo confirms that event. */
  sensorEventId: z.string().uuid().nullable().optional(),
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

  // "Add photo" on a sensor prompt counts as "Yes", with the photo attached (architecture §5.2).
  if (d.sensorEventId) {
    const admin = createAdminClient();
    const { data: event } = await admin.from("sensor_events").select("*").eq("id", d.sensorEventId).eq("unit_id", tenant.unit.id).maybeSingle();
    if (event) {
      if (event.confirmation === "pending") {
        await admin.from("sensor_events").update({ confirmation: "yes", confirmed_at: new Date().toISOString() }).eq("id", event.id);
      }
      if (event.ticket_id) {
        // Emergency: the ticket already exists, so the photo joins it.
        await admin.from("reports").insert({
          unit_id: tenant.unit.id,
          tenant_id: tenant.id,
          source: "tenant",
          sensor_event_id: event.id,
          text: d.text || null,
          transcript: d.transcript || null,
          media_paths: d.mediaPaths,
          frame_paths: d.framePaths,
          ticket_id: event.ticket_id,
        });
        await addEvent(admin, event.ticket_id, "tenant_confirmed", "tenant", { photo: d.mediaPaths.length > 0 });
        revalidatePath("/app");
        return { ticketId: event.ticket_id };
      }
      const { createSensorTicket, sensorReportText } = await import("@/lib/sensors");
      const sensorTicket = await createSensorTicket(admin, { ...event, confirmation: "yes" }, tenant.id);
      await admin
        .from("reports")
        .update({
          text: [sensorReportText(event, "yes"), d.text].filter(Boolean).join("\n"),
          transcript: d.transcript || null,
          media_paths: d.mediaPaths,
          frame_paths: d.framePaths,
        })
        .eq("ticket_id", sensorTicket);
      after(() => runProcessTicket(sensorTicket));
      revalidatePath("/app");
      return { ticketId: sensorTicket };
    }
  }

  const ticketId = await createTenantReport({
    tenantId: tenant.id,
    unitId: tenant.unit.id,
    buildingId: tenant.building.id,
    text: d.text || null,
    transcript: d.transcript || null,
    mediaPaths: d.mediaPaths,
    framePaths: d.framePaths,
  });

  after(() => runProcessTicket(ticketId));

  revalidatePath("/app");
  return { ticketId };
}

/** Classification after the response; a failure sends the ticket to "needs triage". */
async function runProcessTicket(ticketId: string) {
  try {
    await processTicket(ticketId);
  } catch (err) {
    console.error("processTicket failed", err);
    const admin = createAdminClient();
    await admin.from("tickets").update({ needs_triage: true }).eq("id", ticketId);
  }
}

// ---------------------------------------------------------------- sensor prompts (architecture §5.2)

export async function answerSensorPrompt(eventId: string, answer: "yes" | "no") {
  const tenant = await requireTenant();
  const admin = createAdminClient();
  const { data: event } = await admin.from("sensor_events").select("id").eq("id", eventId).eq("unit_id", tenant.unit.id).maybeSingle();
  if (!event) return;
  const { answerSensorEvent } = await import("@/lib/sensors");
  const result = await answerSensorEvent(admin, eventId, tenant, answer);
  if (result.classify) {
    const id = result.classify;
    after(() => runProcessTicket(id));
  }
  revalidatePath("/app");
  revalidatePath("/app/history");
  if (answer === "yes" && result.ticketId) redirect(`/app/tickets/${result.ticketId}`);
}

// ---------------------------------------------------------------- availability and appointments (architecture §5.7)

const Windows = z.array(z.object({ starts_at: z.string().datetime(), ends_at: z.string().datetime() })).min(1).max(42);

export type AvailabilityResult = { status: "booked" | "proposed" | "no_overlap" } | { error: string };

/** The tenant marks when they're home; code matches it against the technician pool and books. */
export async function saveAvailability(ticketId: string, windows: { starts_at: string; ends_at: string }[]): Promise<AvailabilityResult> {
  const { tenant, ticket } = await assertTenantTicket(ticketId);
  const parsed = Windows.safeParse(windows);
  if (!parsed.success) return { error: "Pick at least one time." };
  if (ticket.unit_id !== tenant.unit.id || ticket.next_step !== "schedule_technician") return { error: "This ticket doesn't need a booking." };
  const admin = createAdminClient();
  const { activeAppointment, matchAndBook } = await import("@/lib/scheduling");
  if (await activeAppointment(admin, ticketId)) return { error: "This ticket already has an appointment." };

  await admin.from("tenant_windows").delete().eq("ticket_id", ticketId);
  await admin.from("tenant_windows").insert(parsed.data.map((w) => ({ ticket_id: ticketId, tenant_id: tenant.id, starts_at: w.starts_at, ends_at: w.ends_at })));
  await addEvent(admin, ticketId, "availability", "tenant", { windows: parsed.data.length });
  const result = await matchAndBook(admin, ticketId);
  revalidatePath(`/app/tickets/${ticketId}`);
  revalidatePath("/app");
  if (result.status === "missing") return { error: "Ticket not found" };
  return { status: result.status };
}

/** Reminder replies: "I'll be home" / "Someone else will let them in" / "Reschedule". */
export async function replyToAppointment(appointmentId: string, reply: "home" | "someone_else" | "reschedule") {
  const tenant = await requireTenant();
  const supabase = await createClient();
  // RLS: the tenant can only read appointments of tickets they can see.
  const { data: appt } = await supabase.from("appointments").select("id, ticket_id, status, starts_at, ends_at").eq("id", appointmentId).maybeSingle();
  if (!appt || appt.status !== "booked") return;
  const admin = createAdminClient();
  await admin.from("appointments").update({ tenant_reply: reply }).eq("id", appointmentId);
  const text =
    reply === "home" ? "I'll be home." : reply === "someone_else" ? "Someone else will let them in." : "I can't make this time. Please reschedule.";
  await addMessage(admin, appt.ticket_id, "tenant", text, tenant.name);
  await addEvent(admin, appt.ticket_id, "tenant_reply", "tenant", { reply });
  if (reply === "reschedule") {
    const { cancelForReschedule } = await import("@/lib/scheduling");
    await cancelForReschedule(admin, appointmentId, "tenant asked to reschedule");
    await addMessage(admin, appt.ticket_id, "ai", "No problem. We've freed that slot. Pick a few new times below and we'll book again.");
  }
  revalidatePath(`/app/tickets/${appt.ticket_id}`);
  revalidatePath("/app");
}

/** "Got it" on a Home notice. */
export async function markNoticeRead(noticeId: string) {
  const tenant = await requireTenant();
  const admin = createAdminClient();
  await admin.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", noticeId).eq("tenant_id", tenant.id);
  revalidatePath("/app");
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
  await applyQuickFixOutcome(createAdminClient(), ticketId, worked);
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

// ---------------------------------------------------------------- chatbot (architecture §5.6)

export async function sendChatMessage(form: FormData) {
  const tenant = await requireTenant();
  const text = String(form.get("text") ?? "").trim().slice(0, 1000);
  if (!text) return;
  const { chat } = await import("@/lib/ai/chatbot");
  await chat(tenant, text);
  revalidatePath("/app/messages/assistant");
}
