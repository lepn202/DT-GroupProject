import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin, Phone } from "lucide-react";
import { FixaLockup } from "@/components/logo";
import { MediaGallery } from "@/components/media-gallery";
import { Button, Card, SectionLabel, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { finishVisit, setVisitStatus, toggleSlot } from "@/lib/actions/technician";
import { berlinParts, berlinTime, formatSlot, TRADE_LABEL, type Trade } from "@/lib/domain";
import { signMedia } from "@/lib/media";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Your jobs", robots: { index: false, follow: false }, referrer: "no-referrer" };

type Job = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  technician_status: string | null;
  outcome: string | null;
  ticket: {
    id: string;
    summary: string | null;
    scope: string;
    unit_id: string | null;
    building: { name: string; address: string };
    unit: { number: string; floor: number } | null;
  };
};

const STATUS_LABEL: Record<string, string> = { confirmed: "You confirmed", late: "You said you're running late", on_site: "You're on site" };

// Technician link page (architecture §5.7): no account, the long random token is the key.
// Shows only this technician's jobs, with the minimum contact details (§11).
export default async function TechnicianPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{48}$/.test(token)) notFound();
  const admin = createAdminClient();
  const { data: tech } = await admin.from("technicians").select("id, name, trade").eq("link_token", token).is("removed_at", null).maybeSingle();
  if (!tech) notFound();

  const now = new Date();
  const [{ data: jobRows }, { data: slots }] = await Promise.all([
    admin
      .from("appointments")
      .select("id, starts_at, ends_at, status, technician_status, outcome, ticket:tickets(id, summary, scope, unit_id, building:buildings(name, address), unit:units(number, floor))")
      .eq("technician_id", tech.id)
      .in("status", ["booked", "done"])
      .gte("ends_at", new Date(now.getTime() - 7 * 864e5).toISOString())
      .order("starts_at"),
    admin.from("tech_slots").select("starts_at").eq("technician_id", tech.id).gte("starts_at", now.toISOString()),
  ]);
  const jobs = (jobRows ?? []) as unknown as Job[];
  const upcoming = jobs.filter((j) => j.status === "booked");
  const done = jobs.filter((j) => j.status === "done").reverse().slice(0, 5);

  // Media and the tenant's first name and phone, only for booked jobs.
  const ticketIds = upcoming.map((j) => j.ticket.id);
  const { data: reports } = ticketIds.length
    ? await admin.from("reports").select("ticket_id, media_paths").in("ticket_id", ticketIds)
    : { data: [] as { ticket_id: string; media_paths: string[] }[] };
  const unitIds = upcoming.map((j) => j.ticket.unit_id).filter(Boolean) as string[];
  const { data: contacts } = unitIds.length ? await admin.from("tenants").select("unit_id, name, phone").in("unit_id", unitIds) : { data: [] as { unit_id: string; name: string; phone: string }[] };
  const urls = await signMedia((reports ?? []).flatMap((r) => r.media_paths as string[]));

  // Availability grid: weekdays and Saturdays, 08:00–18:00, next 14 days.
  const offered = new Set((slots ?? []).map((s) => new Date(s.starts_at).toISOString()));
  const bookedStarts = new Set(upcoming.map((j) => new Date(j.starts_at).toISOString()));
  const today = berlinParts(now);
  const days: { label: string; slots: { iso: string; label: string }[] }[] = [];
  for (let d = 1; d <= 14; d++) {
    const noon = berlinTime(today.year, today.month, today.day + d, 12);
    const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "Europe/Berlin" }).format(noon);
    if (weekday === "Sun") continue;
    days.push({
      label: new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" }).format(noon),
      slots: [8, 10, 12, 14, 16].map((h) => ({ iso: berlinTime(today.year, today.month, today.day + d, h).toISOString(), label: `${String(h).padStart(2, "0")}–${h + 2}` })),
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-3">
        <FixaLockup />
        <div>
          <h1 className="text-[26px] leading-8 font-bold">Hello {tech.name.split(" ")[0]}</h1>
          <p className="text-muted-foreground">
            {TRADE_LABEL[tech.trade as Exclude<Trade, "none">]} · your jobs and when you&apos;re free. Keep this link private.
          </p>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <SectionLabel>Upcoming jobs</SectionLabel>
        {upcoming.length === 0 && <Card className="px-4 py-6 text-center text-muted-foreground">No jobs booked right now.</Card>}
        {upcoming.map((j) => {
          const t = j.ticket;
          const contact = (contacts ?? []).find((c) => c.unit_id === t.unit_id);
          const media = (reports ?? []).filter((r) => r.ticket_id === t.id).flatMap((r) => r.media_paths as string[]);
          return (
            <Card key={j.id} className="flex flex-col gap-3 p-4">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-sm font-semibold">{formatSlot(j.starts_at, j.ends_at)}</span>
                <h2 className="text-lg leading-6 font-semibold">{t.summary ?? "Repair"}</h2>
                <span className="flex items-start gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {t.building.address}
                  {t.scope === "building" ? " · whole building (boiler / shared pipes)" : ` · flat ${t.unit?.number}, floor ${t.unit?.floor}`}
                </span>
                {contact && (
                  <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                    <Phone className="size-4" aria-hidden /> {contact.name.split(" ")[0]}, {contact.phone}
                  </a>
                )}
              </div>
              <MediaGallery paths={media} urls={urls} />
              {j.technician_status && <p className="text-sm font-semibold text-stage-progress">{STATUS_LABEL[j.technician_status]}</p>}
              <div className="grid grid-cols-3 gap-2">
                <form action={setVisitStatus.bind(null, token, j.id, "confirmed")}>
                  <Button variant={j.technician_status ? "secondary" : "primary"} className="w-full px-2">
                    Confirmed
                  </Button>
                </form>
                <form action={setVisitStatus.bind(null, token, j.id, "late")}>
                  <Button variant="secondary" className="w-full px-2">
                    Running late
                  </Button>
                </form>
                <form action={setVisitStatus.bind(null, token, j.id, "on_site")}>
                  <Button variant={j.technician_status === "confirmed" || j.technician_status === "late" ? "primary" : "secondary"} className="w-full px-2">
                    On site
                  </Button>
                </form>
              </div>
              <details className="rounded-lg border border-border">
                <summary className="flex min-h-11 cursor-pointer items-center px-3 font-semibold">Done…</summary>
                <form action={finishVisit.bind(null, token, j.id)} className="flex flex-col gap-2 border-t border-border p-3">
                  {[
                    ["completed", "Completed", "The problem is fixed"],
                    ["needs_follow_up", "Needs a follow-up", "Parts or a second visit needed"],
                    ["no_access", "No access", "Nobody let me in"],
                  ].map(([value, label, hint], i) => (
                    <label key={value} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
                      <input type="radio" name="outcome" value={value} defaultChecked={i === 0} className="mt-1 accent-[var(--primary)]" />
                      <span className="flex flex-col">
                        <span className="font-semibold">{label}</span>
                        <span className="text-sm text-muted-foreground">{hint}</span>
                      </span>
                    </label>
                  ))}
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold">Note (optional)</span>
                    <Textarea name="note" rows={2} placeholder="e.g. Replaced the valve" />
                  </label>
                  <SubmitButton pendingText="Saving…">Finish visit</SubmitButton>
                </form>
              </details>
            </Card>
          );
        })}
      </section>

      <section className="flex flex-col gap-3">
        <SectionLabel>When you&apos;re free</SectionLabel>
        <p className="text-sm text-muted-foreground">Tap a slot to offer or remove it. Bookings only go into offered slots.</p>
        <div className="flex flex-col gap-3">
          {days.map((d) => (
            <div key={d.label} className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">{d.label}</span>
              <div className="grid grid-cols-5 gap-1.5">
                {d.slots.map((s) => {
                  const booked = bookedStarts.has(s.iso);
                  const on = offered.has(s.iso);
                  return (
                    <form key={s.iso} action={toggleSlot.bind(null, token, s.iso)}>
                      <button
                        disabled={booked}
                        aria-pressed={on}
                        aria-label={`${d.label} ${s.label}: ${booked ? "booked" : on ? "offered" : "not offered"}`}
                        className={cn(
                          "min-h-11 w-full rounded-md border text-xs font-semibold",
                          booked ? "border-stage-progress bg-stage-progress text-white" : on ? "border-primary bg-primary-soft text-primary-hover" : "border-border bg-card text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {booked ? "Booked" : s.label}
                      </button>
                    </form>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {done.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionLabel>Recently finished</SectionLabel>
          {done.map((j) => (
            <div key={j.id} className="flex justify-between gap-3 text-sm">
              <span>{j.ticket.summary}</span>
              <span className="whitespace-nowrap text-muted-foreground">{j.outcome?.replace(/_/g, " ")}</span>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
