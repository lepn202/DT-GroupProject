import "server-only";
import { berlinParts, berlinTime, formatSlot, TRADE_LABEL, type Trade } from "@/lib/domain";
import { notifyTenantsOfUnits } from "@/lib/notify";
import { affectedUnits } from "@/lib/scheduling";
import { createAdminClient } from "@/lib/supabase/admin";
import { addEvent } from "@/lib/tickets";

// Appointment reminders (architecture §5.7): the evening before (18:00 Berlin) and 1 hour
// before the slot. Called every 15 minutes by Supabase Cron through /api/cron/reminders.

type Admin = ReturnType<typeof createAdminClient>;

const EVENING_HOUR = 18;

/** Which reminder (1 = evening before, 2 = an hour before) is due now, if any. */
export function dueReminder(startsAt: Date, sent: number, now = new Date()): 1 | 2 | null {
  const msLeft = startsAt.getTime() - now.getTime();
  if (msLeft <= 0) return null;
  if (sent < 2 && msLeft <= 60 * 60 * 1000) return 2;
  if (sent < 1) {
    const day = berlinParts(startsAt);
    const evening = berlinTime(day.year, day.month, day.day - 1, EVENING_HOUR);
    if (now >= evening) return 1;
  }
  return null;
}

/**
 * Sends every reminder that is due. `force` (demo panel only) sends the next reminder for any
 * booked visit in the next 48 hours, so the flow can be shown without waiting.
 */
export async function sendDueReminders(admin: Admin, opts: { force?: boolean; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  const horizon = new Date(now.getTime() + 48 * 36e5).toISOString();
  const { data: appts } = await admin
    .from("appointments")
    .select("id, ticket_id, starts_at, ends_at, reminders_sent, technician:technicians(name, trade), ticket:tickets(id, unit_id, scope, summary)")
    .eq("status", "booked")
    .gt("starts_at", now.toISOString())
    .lte("starts_at", horizon)
    .lt("reminders_sent", 2);

  let sent = 0;
  for (const a of appts ?? []) {
    const which = opts.force ? ((a.reminders_sent + 1) as 1 | 2) : dueReminder(new Date(a.starts_at), a.reminders_sent, now);
    if (!which) continue;
    const tech = a.technician as unknown as { name: string; trade: Exclude<Trade, "none"> };
    const ticket = a.ticket as unknown as { id: string; unit_id: string | null; scope: string; summary: string | null };
    const trade = TRADE_LABEL[tech.trade].toLowerCase();
    const when = formatSlot(a.starts_at, a.ends_at);
    const units = await affectedUnits(admin, ticket);
    await notifyTenantsOfUnits(
      admin,
      units,
      {
        kind: "reminder",
        title: which === 1 ? `Reminder: ${trade} visit ${when}` : `Your ${trade} arrives within the hour (${when})`,
        body: ticket.unit_id
          ? "Will you be home? Tap to answer: I'll be home, someone else will let them in, or reschedule."
          : "For the building-wide repair. Nothing to do unless you've been asked to give access.",
        link: ticket.unit_id ? `/app/tickets/${ticket.id}` : "/app",
        ticketId: ticket.id,
      },
      { email: true },
    );
    await admin.from("appointments").update({ reminders_sent: which }).eq("id", a.id);
    await addEvent(admin, ticket.id, "reminder", "system", { which: which === 1 ? "evening_before" : "hour_before" });
    sent++;
  }
  return { sent };
}
