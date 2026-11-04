import Link from "next/link";
import { ChevronRight, Megaphone } from "lucide-react";
import { IssueIcon } from "@/components/ticket-ui";
import { Card, SectionLabel } from "@/components/ui";
import { requireTenant } from "@/lib/auth";
import { timeAgo, ticketTitle } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import { latestBroadcasts, tenantTickets } from "@/lib/tenant-data";

export default async function MessagesPage() {
  const tenant = await requireTenant();
  const supabase = await createClient();
  const [broadcasts, tickets] = await Promise.all([latestBroadcasts(tenant.building.id), tenantTickets(tenant)]);
  const ids = tickets.map((t) => t.id);
  const { data: messages } = ids.length
    ? await supabase.from("messages").select("ticket_id, text, created_at").in("ticket_id", ids).order("created_at", { ascending: false })
    : { data: [] };
  const last = new Map<string, { text: string; created_at: string }>();
  for (const m of messages ?? []) if (!last.has(m.ticket_id)) last.set(m.ticket_id, m);
  const threads = tickets.filter((t) => last.has(t.id));

  return (
    <>
      <h1 className="text-[28px] leading-[34px] font-bold tracking-[-0.01em]">Messages</h1>

      <section className="flex flex-col gap-3">
        <SectionLabel>Your tickets</SectionLabel>
        {threads.length === 0 && <p className="text-sm text-muted-foreground">Each ticket gets its own thread here.</p>}
        <ul className="flex flex-col gap-2">
          {threads.map((t) => {
            const m = last.get(t.id)!;
            return (
              <li key={t.id}>
                <Link href={`/app/tickets/${t.id}`}>
                  <Card className="flex items-center gap-3 px-4 py-3 hover:border-primary/40">
                    <IssueIcon type={t.issue_type} className="text-muted-foreground" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="font-semibold">{t.classified_by ? ticketTitle(t) : "New report"}</span>
                      <span className="truncate text-sm text-muted-foreground">{m.text}</span>
                    </div>
                    <span className="text-xs whitespace-nowrap text-muted-foreground">{timeAgo(m.created_at)}</span>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <SectionLabel>From your landlord</SectionLabel>
        {broadcasts.length === 0 && <p className="text-sm text-muted-foreground">No announcements yet.</p>}
        <ul className="flex flex-col gap-2">
          {broadcasts.map((b) => (
            <li key={b.id} className="flex gap-3 rounded-xl bg-primary-soft px-4 py-3 text-[#0A3B31]">
              <Megaphone className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} aria-hidden />
              <div className="flex flex-col gap-0.5">
                <span className="label-caps">{timeAgo(b.created_at)}</span>
                <p>{b.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
