import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { MediaGallery } from "@/components/media-gallery";
import { MessageThread, type Message } from "@/components/message-thread";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { ProgressTracker, UrgencyBadge } from "@/components/ticket-ui";
import { Button, Card, Input, SectionLabel } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { postTenantMessage, quickFixOutcome } from "@/lib/actions/tenant";
import { requireTenant } from "@/lib/auth";
import { formatDateTime, ticketTitle, type Ticket } from "@/lib/domain";
import { signMedia } from "@/lib/media";
import { createClient } from "@/lib/supabase/server";

export default async function TenantTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireTenant();
  const supabase = await createClient();
  const { data: ticket } = await supabase.from("tickets").select("*").eq("id", id).maybeSingle<Ticket>();
  if (!ticket) notFound();

  const [{ data: messages }, { data: reports }] = await Promise.all([
    supabase.from("messages").select("*").eq("ticket_id", id).order("created_at"),
    supabase.from("reports").select("text, transcript, media_paths, created_at").eq("ticket_id", id).order("created_at"),
  ]);
  const mediaPaths = (reports ?? []).flatMap((r) => r.media_paths as string[]);
  const urls = await signMedia(mediaPaths);
  const classifying = !ticket.classified_by && ticket.status === "logged";

  return (
    <>
      <RealtimeRefresh
        channel={`ticket-${id}`}
        watch={[
          { table: "tickets", filter: `id=eq.${id}` },
          { table: "messages", filter: `ticket_id=eq.${id}` },
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
