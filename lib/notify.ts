import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Notifications (architecture §5.2, §5.5, §5.7).
// - In-app: a row in `notifications`, shown on the tenant's Home or the landlord's dashboard
//   and delivered live over Realtime. (Web Push to the phone is not wired up yet.)
// - Email: sent through Resend when RESEND_API_KEY is set. Every email is also logged in
//   `notifications`, so the demo panel can show what went out without an email provider.

type Admin = ReturnType<typeof createAdminClient>;

export function appUrl(path = "") {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}

export type Notice = {
  kind: string;
  title: string;
  body?: string;
  link?: string | null;
  ticketId?: string | null;
};

/** In-app notice (and an email copy) to every tenant of the given flats. */
export async function notifyTenantsOfUnits(admin: Admin, unitIds: string[], notice: Notice, opts: { email?: boolean } = {}) {
  if (!unitIds.length) return;
  const { data: tenants } = await admin.from("tenants").select("id, email").in("unit_id", unitIds);
  for (const t of tenants ?? []) await notifyTenant(admin, t, notice, opts);
}

export async function notifyTenant(admin: Admin, tenant: { id: string; email: string }, notice: Notice, opts: { email?: boolean } = {}) {
  await admin.from("notifications").insert({
    channel: "in_app",
    kind: notice.kind,
    tenant_id: tenant.id,
    ticket_id: notice.ticketId ?? null,
    title: notice.title,
    body: notice.body ?? "",
    link: notice.link ?? null,
  });
  if (opts.email) {
    await sendEmail(admin, {
      to: tenant.email,
      kind: notice.kind,
      subject: notice.title,
      text: `${notice.body ?? ""}${notice.link ? `\n\nOpen Fixa: ${appUrl(notice.link)}` : ""}`,
      tenantId: tenant.id,
      ticketId: notice.ticketId,
    });
  }
}

/** Alert for the landlord who owns the building: a dashboard notice plus an email. */
export async function notifyLandlordOfBuilding(admin: Admin, buildingId: string, notice: Notice, opts: { email?: boolean } = {}) {
  const { data } = await admin.from("buildings").select("landlord:landlords(id, email)").eq("id", buildingId).single();
  const landlord = data?.landlord as unknown as { id: string; email: string } | null;
  if (!landlord) return;
  await admin.from("notifications").insert({
    channel: "in_app",
    kind: notice.kind,
    landlord_id: landlord.id,
    ticket_id: notice.ticketId ?? null,
    title: notice.title,
    body: notice.body ?? "",
    link: notice.link ?? null,
  });
  if (opts.email) {
    await sendEmail(admin, {
      to: landlord.email,
      kind: notice.kind,
      subject: notice.title,
      text: `${notice.body ?? ""}${notice.link ? `\n\nOpen the dashboard: ${appUrl(notice.link)}` : ""}`,
      landlordId: landlord.id,
      ticketId: notice.ticketId,
    });
  }
}

export async function emailTechnician(
  admin: Admin,
  tech: { id: string; email: string; link_token: string },
  mail: { kind: string; subject: string; text: string; ticketId?: string | null },
) {
  await sendEmail(admin, {
    to: tech.email,
    kind: mail.kind,
    subject: mail.subject,
    text: `${mail.text}\n\nYour Fixa page (jobs, availability, status): ${appUrl(`/t/${tech.link_token}`)}`,
    technicianId: tech.id,
    ticketId: mail.ticketId,
  });
}

async function sendEmail(
  admin: Admin,
  mail: {
    to: string;
    kind: string;
    subject: string;
    text: string;
    tenantId?: string;
    landlordId?: string;
    technicianId?: string;
    ticketId?: string | null;
  },
) {
  let delivered = false;
  const key = process.env.RESEND_API_KEY;
  if (key) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM ?? "Fixa <onboarding@resend.dev>",
          to: [mail.to],
          subject: mail.subject,
          text: mail.text,
        }),
      });
      delivered = res.ok;
      if (!res.ok) console.error("Resend rejected an email", res.status, await res.text());
    } catch (err) {
      console.error("Email failed", err);
    }
  }
  // Logged either way; `delivered = false` means it was only logged (no provider, or it failed).
  await admin.from("notifications").insert({
    channel: "email",
    kind: mail.kind,
    email: mail.to,
    tenant_id: mail.tenantId ?? null,
    landlord_id: mail.landlordId ?? null,
    technician_id: mail.technicianId ?? null,
    ticket_id: mail.ticketId ?? null,
    title: mail.subject,
    body: mail.text,
    delivered,
  });
}
