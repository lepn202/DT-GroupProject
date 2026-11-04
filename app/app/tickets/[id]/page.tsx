import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Link2, TriangleAlert } from "lucide-react";
import { MediaGallery } from "@/components/media-gallery";
import { MessageThread, type Message } from "@/components/message-thread";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { ProgressTracker, UrgencyBadge } from "@/components/ticket-ui";
import { Button, Card, Input, SectionLabel } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { postTenantMessage, quickFixOutcome, replyToAppointment } from "@/lib/actions/tenant";
import { requireTenant } from "@/lib/auth";
import { availabilityWindows, formatDateTime, formatSlot, ticketTitle, TRADE_LABEL, type Ticket } from "@/lib/domain";
import { createAdminClient } from "@/lib/supabase/admin";
import { AvailabilityPicker } from "./availability-picker";
import { signMedia } from "@/lib/media";
import { createClient } from "@/lib/supabase/server";

export default async function TenantTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await requireTenant();
  const supabase = await createClient();
  const { data: ticket } = await supabase.from("tickets").select("*").eq("id", id).maybeSingle<Ticket>();
  if (!ticket) notFound();

  const [{ data: messages }, { data: reports }] = await Promise.all([
    supabase.from("messages").select("*").eq("ticket_id", id).order("created_at"),
    supabase.from("reports").select("text, transcript, media_paths, created_at").eq("ticket_id", id).order("created_at"),
  ]);
  const mediaPaths = (reports ?? []).flatMap((r) => r.media_paths as string[]);

  // Grouped tickets follow their parent (a building-wide ticket or the same problem reported earlier).
  // The ticket was loaded through RLS above, so reading its parent and appointment server-side is safe.
  const admin = createAdminClient();
  const { data: parent } = ticket.parent_ticket_id
    ? await admin.from("tickets").select("id, issue_type, summary, room, scope, status").eq("id", ticket.parent_ticket_id).maybeSingle()
    : { data: null };
  const visitTicketId = parent?.id ?? id;
  const { data: appts } = await admin
    .from("appointments")
    .select("id, starts_at, ends_at, status, tenant_reply, technician_status, technician:technicians(name, trade)")
    .eq("ticket_id", visitTicketId)
    .in("status", ["proposed", "booked"])
    .order("created_at", { ascending: false })
    .limit(1);
  const appt = appts?.[0] as
    | { id: string; starts_at: string; ends_at: string; status: string; tenant_reply: string | null; technician_status: string | null; technician: { name: string; trade: keyof typeof TRADE_LABEL } }
    | undefined;
  const needsTimes =
    !parent &&
    !appt &&
    ticket.classified_by !== null &&
    ticket.scope === "apartment" &&
    ticket.unit_id === tenant.unit.id &&
    ticket.next_step === "schedule_technician" &&
    ticket.urgency !== "emergency" &&
    (ticket.status === "logged" || ticket.status === "confirmed");
  const urls = await signMedia(mediaPaths);
  const classifying = !ticket.classified_by && ticket.status === "logged";

  return (
    <>
      <RealtimeRefresh
        channel={`ticket-${id}`}
        watch={[
          { table: "tickets", filter: `id=eq.${id}` },
          { table: "messages", filter: `ticket_id=eq.${id}` },
          { table: "appointments", filter: `ticket_id=eq.${visitTicketId}` },
          ...(parent ? [{ table: "tickets" as const, filter: `id=eq.${parent.id}` }] : []),
        ]}
      />
      <Link href="/app" className="flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-primary">
        <ArrowLeft className="size-4" aria-hidden /> Home
      </Link>

      {ticket.safety_advice && (
        <div role="alert" className="flex gap-3 rounded-xl bg-emergency px-4 py-3.5 text-white">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="font-semibold">{ticket.safety_advice}</p>
        </div>
      )}

      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-[26px] leading-8 font-bold tracking-[-0.01em]">{classifying ? "New report" : ticketTitle(ticket)}</h1>
          {ticket.urgency === "emergency" && <UrgencyBadge urgency="emergency" />}
        </div>
        <p className="text-muted-foreground">
          {classifying ? "Received, we're on it. Working out what's needed…" : ticket.summary}
        </p>
        <span className="font-mono text-[13px] text-muted-foreground">Reported {formatDateTime(ticket.created_at)}</span>
      </header>

      <Card className="p-4">
        {ticket.status === "dismissed" ? (
          <p className="text-sm text-muted-foreground">Closed without a repair.</p>
        ) : (
          <ProgressTracker status={ticket.status} />
        )}
      </Card>

      {parent && (
        <div className="flex gap-3 rounded-xl bg-primary-soft px-4 py-3.5 text-[#0A3B31]">
          <Link2 className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="text-[15px] leading-[22px]">
            {parent.scope === "building" ? "Part of a building-wide problem: " : "Linked to a problem we already know about: "}
            <span className="font-semibold">{ticketTitle(parent as Pick<Ticket, "issue_type" | "summary" | "room" | "scope">)}</span>. One repair covers everyone affected.
          </p>
        </div>
      )}

      {appt && (
        <Card className="flex flex-col gap-3 p-4">
          <SectionLabel>{appt.status === "proposed" ? "Appointment (waiting for your landlord)" : "Appointment"}</SectionLabel>
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 size-5 shrink-0 text-stage-progress" strokeWidth={1.75} aria-hidden />
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold">{formatSlot(appt.starts_at, appt.ends_at)}</span>
              <span className="text-sm text-muted-foreground">
                {appt.technician.name} · {TRADE_LABEL[appt.technician.trade]}
                {appt.technician_status === "confirmed" && " · confirmed"}
                {appt.technician_status === "late" && " · running late"}
                {appt.technician_status === "on_site" && " · on site now"}
              </span>
            </div>
          </div>
          {appt.status === "booked" && !parent && (
            appt.tenant_reply && appt.tenant_reply !== "reschedule" ? (
              <p className="text-sm">
                You said: <span className="font-semibold">{appt.tenant_reply === "home" ? "I'll be home" : "Someone else will let them in"}</span>
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <form action={replyToAppointment.bind(null, appt.id, "home")}>
                  <Button className="w-full">I&apos;ll be home</Button>
                </form>
                <form action={replyToAppointment.bind(null, appt.id, "someone_else")}>
                  <Button variant="secondary" className="w-full">
                    Someone else will let them in
                  </Button>
                </form>
                <form action={replyToAppointment.bind(null, appt.id, "reschedule")}>
                  <Button variant="ghost" className="w-full underline">
                    Reschedule
                  </Button>
                </form>
              </div>
            )
          )}
        </Card>
      )}

      {needsTimes && <AvailabilityPicker ticketId={id} windows={availabilityWindows()} dueAt={ticket.due_at} retry={ticket.needs_windows} />}

      {ticket.status === "quick_fix" && (
        <Card className="flex flex-col gap-3 p-4">
          <SectionLabel>Quick fix</SectionLabel>
          <p className="whitespace-pre-line">{ticket.quick_fix_text}</p>
          <div className="grid grid-cols-2 gap-2">
            <form action={quickFixOutcome.bind(null, id, true)}>
              <Button className="w-full">Fixed it</Button>
            </form>
            <form action={quickFixOutcome.bind(null, id, false)}>
              <Button variant="secondary" className="w-full">
                Didn&apos;t work
              </Button>
            </form>
          </div>
        </Card>
      )}

      {mediaPaths.length > 0 && <MediaGallery paths={mediaPaths} urls={urls} />}
      {reports?.map((r, i) =>
        r.transcript || r.text ? (
          <Card key={i} className="flex flex-col gap-1 p-4">
            {r.transcript && (
              <>
                <SectionLabel>Your voice memo</SectionLabel>
                <p>{r.transcript}</p>
              </>
            )}
            {r.text && (
              <>
                <SectionLabel className={r.transcript ? "mt-2" : ""}>Your note</SectionLabel>
                <p>{r.text}</p>
              </>
            )}
          </Card>
        ) : null,
      )}

      <section className="flex flex-col gap-3">
        <SectionLabel>Messages</SectionLabel>
        <MessageThread messages={(messages ?? []) as Message[]} viewer="tenant" />
        {ticket.status !== "dismissed" && (
          <form action={postTenantMessage.bind(null, id)} className="flex gap-2">
            <Input name="text" placeholder="Write a message" aria-label="Message" required />
            <SubmitButton pendingText="…">Send</SubmitButton>
          </form>
        )}
      </section>
    </>
  );
}
