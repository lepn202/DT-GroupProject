import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleHelp, TriangleAlert } from "lucide-react";
import { Page, PageHeader } from "@/components/dashboard-ui";
import { MediaGallery } from "@/components/media-gallery";
import { MessageThread, type Message } from "@/components/message-thread";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { DueTag, ProgressTracker, StageChip, UrgencyBadge } from "@/components/ticket-ui";
import { Button, Card, Input, SectionLabel } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { confirmAppointment, dismissTicket, postLandlordMessage } from "@/lib/actions/landlord";
import { suggestSlots, ticketTrade } from "@/lib/scheduling";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";
import { BookingPanel, type SlotOption } from "./booking-panel";
import { requireLandlord } from "@/lib/auth";
import { formatDateTime, formatSlot, isOpen, progressOf, ticketTitle, TRADE_LABEL, withArticle, type Ticket } from "@/lib/domain";
import { signMedia } from "@/lib/media";
import { createClient } from "@/lib/supabase/server";
import { ClassificationForm } from "./classification-form";

const EVENT_LABEL: Record<string, string> = {
  created: "Reported",
  classified: "Classified",
  reclassified: "Classification changed",
  status: "Status changed",
  escalated: "Quick fix didn't work, technician needed",
  archived: "Dismissed to the archive",
  tenant_confirmed: "Tenant confirmed the sensor alert",
  tenant_said_no: "Tenant said they don't see it",
  linked: "Linked to an existing ticket",
  report_linked: "Another report linked",
  grouped: "Building-wide ticket created from sensor events",
  appointment_moved: "Flat appointment now covers the building",
  neighbour_notified: "Flat below warned",
  availability: "Tenant sent their times",
  no_overlap: "No technician free at the tenant's times",
  proposed: "Appointment proposed (manual mode)",
  tenant_reply: "Tenant replied to the appointment",
  reminder: "Reminder sent",
  technician_confirmed: "Technician confirmed",
  technician_late: "Technician running late",
};

const REPLY_LABEL: Record<string, string> = { home: "I'll be home", someone_else: "Someone else will let them in", reschedule: "Reschedule" };
const OUTCOME_LABEL: Record<string, string> = { completed: "Completed", needs_follow_up: "Needs follow-up", no_access: "No access (missed)" };
const TECH_STATUS_LABEL: Record<string, string> = { confirmed: "confirmed", late: "running late", on_site: "on site" };

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const landlord = await requireLandlord();
  const supabase = await createClient();
  const { data: ticket } = await supabase
    .from("tickets")
    .select("*, building:buildings(id, name), unit:units(number, floor)")
    .eq("id", id)
    .maybeSingle<Ticket & { building: { id: string; name: string }; unit: { number: string; floor: number } | null }>();
  if (!ticket) notFound();

  const [{ data: reports }, { data: events }, { data: messages }, { data: appointments }, { data: children }] = await Promise.all([
    supabase.from("reports").select("*, tenant:tenants(name, phone, email), unit:units(number)").eq("ticket_id", id).order("created_at"),
    supabase.from("ticket_events").select("*").eq("ticket_id", id).order("created_at"),
    supabase.from("messages").select("*").eq("ticket_id", id).order("created_at"),
    supabase.from("appointments").select("*, technician:technicians(name, trade, phone)").eq("ticket_id", id).order("starts_at"),
    supabase.from("tickets").select("id, summary, unit:units(number)").eq("parent_ticket_id", id),
  ]);
  const paths = (reports ?? []).flatMap((r) => r.media_paths as string[]);
  const { data: parent } = ticket.parent_ticket_id
    ? await supabase.from("tickets").select("id, issue_type, summary, room, scope").eq("id", ticket.parent_ticket_id).maybeSingle()
    : { data: null };
  const active = appointments?.find((a) => a.status === "booked" || a.status === "proposed");
  const proposed = active?.status === "proposed" ? active : null;
  const canBook = isOpen(ticket) && !parent && ticket.classified_by !== null && ticket.next_step === "schedule_technician" && (!active || proposed);
  const emergency = ticket.urgency === "emergency";
  let options: SlotOption[] = [];
  if (canBook) {
    const slots = await suggestSlots(createAdminClient(), landlord.id, ticketTrade(ticket));
    options = slots.map((sl) => ({
      value: `${sl.technician.id}|${sl.starts_at}|${sl.ends_at}`,
      technician: sl.technician.name,
      trade: TRADE_LABEL[sl.technician.trade],
      when: formatSlot(sl.starts_at, sl.ends_at),
      custom: sl.custom,
    }));
  }
  const urls = await signMedia(paths);
  const firstReport = reports?.[0];
  const reporter = firstReport?.tenant as { name: string; phone: string; email: string } | null;

  return (
    <Page>
      <RealtimeRefresh
        channel={`ticket-${id}`}
        watch={[
          { table: "tickets", filter: `id=eq.${id}` },
          { table: "messages", filter: `ticket_id=eq.${id}` },
          { table: "appointments", filter: `ticket_id=eq.${id}` },
        ]}
      />
      <PageHeader
        crumbs={
          <>
            <Link href="/dashboard" className="hover:underline">
              Portfolio
            </Link>{" "}
            /{" "}
            <Link href={`/dashboard/buildings/${ticket.building.id}`} className="hover:underline">
              {ticket.building.name}
            </Link>{" "}
            / Ticket
          </>
        }
        title={ticket.classified_by ? ticketTitle(ticket) : "New report"}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <UrgencyBadge urgency={ticket.urgency} />
            <StageChip status={ticket.status} />
            <DueTag ticket={ticket} />
            <span>· {ticket.scope === "building" ? "Whole building" : `Flat ${ticket.unit?.number ?? "?"}`}</span>
          </span>
        }
        actions={
          !isOpen(ticket) && !ticket.archived_at ? (
            <form action={dismissTicket.bind(null, id)}>
              <Button variant="secondary">Dismiss to archive</Button>
            </form>
          ) : undefined
        }
      />

      {parent && (
        <div className="flex gap-3 rounded-xl bg-primary-soft px-4 py-3.5 text-[#0A3B31]">
          <span>
            Part of{" "}
            <Link href={`/dashboard/tickets/${parent.id}`} className="font-semibold underline">
              {ticketTitle(parent as Pick<Ticket, "issue_type" | "summary" | "room" | "scope">)}
            </Link>
            . It follows that ticket&apos;s progress and visit.
          </span>
        </div>
      )}
      {ticket.needs_windows && isOpen(ticket) && !active && (
        <div className="flex gap-3 rounded-xl bg-medium-tint px-4 py-3.5 text-medium-text">
          <CircleHelp className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span>No technician is free at the tenant&apos;s times. They&apos;ve been asked for more, or you can book a slot below.</span>
        </div>
      )}
      {emergency && isOpen(ticket) && !active && (
        <div role="alert" className="flex gap-3 rounded-xl border border-emergency bg-emergency-tint px-4 py-3.5 text-emergency-text">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold">Emergency: book a technician now (see “Book now” on the right).</span>
            <span className="text-sm">The tenant doesn&apos;t need to confirm or send times first.{ticket.safety_advice ? ` They were shown: “${ticket.safety_advice}”` : ""}</span>
          </div>
        </div>
      )}
      {ticket.needs_triage && isOpen(ticket) && (
        <div className="flex gap-3 rounded-xl bg-medium-tint px-4 py-3.5 text-medium-text">
          <CircleHelp className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span>The AI wasn&apos;t sure about this one. Check the classification below and save it.</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4 p-5">
            <SectionLabel>Report</SectionLabel>
            <p className="text-lg">{ticket.summary ?? "Classifying…"}</p>
            <MediaGallery paths={paths} urls={urls} />
            {reports?.map((r) => (
              <div key={r.id} className="flex flex-col gap-1 border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">
                  {r.source === "sensor" ? "Sensor event" : "Tenant report"} · Flat {(r.unit as { number: string } | null)?.number} ·{" "}
                  <span className="font-mono">{formatDateTime(r.created_at)}</span>
                </span>
                {r.transcript && (
                  <p>
                    <span className="font-semibold">Voice memo: </span>“{r.transcript}”
                  </p>
                )}
                {r.text && <p>{r.text}</p>}
              </div>
            ))}
          </Card>

          <Card className="flex flex-col gap-4 p-5">
            <SectionLabel>Messages on this ticket</SectionLabel>
            <MessageThread messages={(messages ?? []) as Message[]} viewer="landlord" />
            <form action={postLandlordMessage.bind(null, id)} className="flex gap-2">
              <Input name="text" placeholder="Reply to the tenant" aria-label="Reply" required />
              <SubmitButton pendingText="…">Send</SubmitButton>
            </form>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-3 p-5">
            <div className="flex items-baseline justify-between">
              <SectionLabel>Progress</SectionLabel>
              <span className="font-mono text-sm font-semibold">{progressOf(ticket.status)} % complete</span>
            </div>
            <ProgressTracker status={ticket.status} />
          </Card>

          <Card className="flex flex-col gap-2 p-5">
            <SectionLabel>Reported by</SectionLabel>
            {reporter ? (
              <>
                <span className="font-semibold">
                  {reporter.name} · Flat {ticket.unit?.number}
                </span>
                <a href={`tel:${reporter.phone}`} className="text-sm text-primary hover:underline">
                  {reporter.phone}
                </a>
                <a href={`mailto:${reporter.email}`} className="text-sm text-primary hover:underline">
                  {reporter.email}
                </a>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">
                {ticket.scope === "building" && !firstReport ? "Grouped from sensor events in several flats" : firstReport?.source === "sensor" ? "Building sensor" : "Unknown"}
              </span>
            )}
            {children && children.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Linked flats: {children.map((c) => (c.unit as unknown as { number: string } | null)?.number).filter(Boolean).join(", ")}
              </p>
            )}
          </Card>

          <Card className={cn("flex flex-col gap-3 p-5", canBook && emergency && "border-emergency")}>
            <SectionLabel>Technician and appointment</SectionLabel>
            {appointments?.map((a) => {
              const tech = a.technician as { name: string; trade: keyof typeof TRADE_LABEL; phone: string } | null;
              const current = a.status === "booked" || a.status === "proposed";
              return (
                <div key={a.id} className={cn("flex flex-col gap-0.5 text-sm", !current && "text-muted-foreground")}>
                  <span className={cn("font-mono", current && "font-semibold text-foreground")}>{formatSlot(a.starts_at, a.ends_at)}</span>
                  <span>
                    {tech?.name} ({tech ? TRADE_LABEL[tech.trade] : ""}) · {a.status}
                    {a.booked_by === "landlord" ? " by you" : ""}
                    {a.technician_status ? ` · ${TECH_STATUS_LABEL[a.technician_status]}` : ""}
                  </span>
                  {tech?.phone && current && (
                    <a href={`tel:${tech.phone}`} className="text-primary hover:underline">
                      {tech.phone}
                    </a>
                  )}
                  {a.tenant_reply && <span>Tenant: {REPLY_LABEL[a.tenant_reply]}</span>}
                  {a.outcome && (
                    <span className={cn(a.outcome === "no_access" && "font-semibold text-emergency-text")}>
                      Outcome: {OUTCOME_LABEL[a.outcome]}
                      {a.outcome_note ? `: ${a.outcome_note}` : ""}
                    </span>
                  )}
                </div>
              );
            })}
            {proposed && (
              <form action={confirmAppointment.bind(null, id, proposed.id)}>
                <Button className="w-full">Confirm this appointment</Button>
              </form>
            )}
            {canBook ? (
              <BookingPanel
                ticketId={id}
                options={options}
                emergency={emergency && !proposed}
                title={proposed ? "Or pick another slot" : emergency ? "Book now: no tenant step needed" : "Book a technician"}
              />
            ) : (
              !appointments?.length && (
                <span className="text-sm text-muted-foreground">
                  {parent
                    ? "Covered by the linked ticket's visit."
                    : ticket.next_step === "schedule_technician"
                      ? `Waiting for the tenant's times. Needs ${withArticle(ticket.trade && ticket.trade !== "none" ? TRADE_LABEL[ticket.trade].toLowerCase() : "technician")}.`
                      : "No technician needed."}
                </span>
              )
            )}
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <div className="flex items-baseline justify-between">
              <SectionLabel>Classification</SectionLabel>
              <span className="text-xs text-muted-foreground">
                by {ticket.classified_by ?? "—"}
                {ticket.classification_confidence != null && ` · ${Math.round(Number(ticket.classification_confidence) * 100)} %`}
              </span>
            </div>
            {ticket.classified_by ? <ClassificationForm ticket={ticket} /> : <p className="text-sm text-muted-foreground">Classifying…</p>}
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <SectionLabel>Timeline</SectionLabel>
            <ol className="flex flex-col gap-2 border-l border-border pl-4">
              {events?.map((e) => (
                <li key={e.id} className="relative text-sm">
                  <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-border" aria-hidden />
                  <span className="font-semibold">{EVENT_LABEL[e.type] ?? e.type}</span>
                  {e.type === "status" && e.data?.status ? ` → ${e.data.status}` : ""}
                  {e.type === "classified" && e.data?.urgency ? ` · ${e.data.issue_type}, ${e.data.urgency}` : ""}
                  <div className="text-xs text-muted-foreground">
                    {e.actor} · <span className="font-mono">{formatDateTime(e.created_at)}</span>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </Page>
  );
}
