import Link from "next/link";
import { BellRing } from "lucide-react";
import { IssueIcon, StageChip } from "@/components/ticket-ui";
import { Card, SectionLabel } from "@/components/ui";
import { requireTenant } from "@/lib/auth";
import { formatDate, ticketTitle } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import { tenantTickets } from "@/lib/tenant-data";

const METRIC_LABEL: Record<string, string> = {
  temperature: "Cold room",
  leak: "Leak detected",
  hot_water: "No hot water",
  humidity: "High humidity",
};

export default async function HistoryPage() {
  const tenant = await requireTenant();
  const supabase = await createClient();
  const [tickets, { data: alerts }] = await Promise.all([
    tenantTickets(tenant),
    supabase.from("sensor_events").select("*").eq("unit_id", tenant.unit.id).neq("confirmation", "pending").order("occurred_at", { ascending: false }),
  ]);

  return (
    <>
      <h1 className="text-[28px] leading-[34px] font-bold tracking-[-0.01em]">History</h1>
      <section className="flex flex-col gap-3">
        <SectionLabel>Tickets</SectionLabel>
        {tickets.length === 0 && <Card className="px-4 py-6 text-center text-muted-foreground">No tickets yet.</Card>}
        <ul className="flex flex-col gap-2">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link href={`/app/tickets/${t.id}`}>
                <Card className="flex items-center gap-3 px-4 py-3 hover:border-primary/40">
                  <IssueIcon type={t.issue_type} className="text-muted-foreground" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">{t.classified_by ? ticketTitle(t) : "New report"}</span>
                    <span className="font-mono text-[13px] text-muted-foreground">{formatDate(t.created_at)}</span>
                  </div>
                  <StageChip status={t.status} />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-3">
        <SectionLabel>Sensor alerts</SectionLabel>
        {!alerts?.length && <p className="text-sm text-muted-foreground">No sensor alerts so far.</p>}
        <ul className="flex flex-col gap-2">
          {alerts?.map((a) => (
            <li key={a.id}>
              <Card className="flex items-center gap-3 px-4 py-3">
                <BellRing className="size-5 text-muted-foreground" strokeWidth={1.75} aria-hidden />
                <div className="flex flex-1 flex-col">
                  <span className="font-semibold">{METRIC_LABEL[a.metric] ?? a.metric}</span>
                  <span className="font-mono text-[13px] text-muted-foreground">{formatDate(a.occurred_at)}</span>
                </div>
                <span className="text-sm text-muted-foreground">{a.confirmation === "yes" ? "Confirmed" : "Dismissed"}</span>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
