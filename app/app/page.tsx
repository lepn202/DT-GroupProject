import Link from "next/link";
import { Camera, Megaphone, Mic } from "lucide-react";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { TenantTicketCard } from "@/components/tenant-ticket-card";
import { IssueIcon, ProgressTracker } from "@/components/ticket-ui";
import { Card, SectionLabel } from "@/components/ui";
import { requireTenant } from "@/lib/auth";
import { isOpen, ISSUE_LABEL, timeAgo } from "@/lib/domain";
import { latestBroadcasts, tenantTickets } from "@/lib/tenant-data";

export default async function TenantHome() {
  const tenant = await requireTenant();
  const [tickets, broadcasts] = await Promise.all([tenantTickets(tenant), latestBroadcasts(tenant.building.id, 1)]);
  const buildingWide = tickets.filter((t) => t.scope === "building" && isOpen(t));
  const mine = tickets.filter((t) => t.scope !== "building" && t.unit_id === tenant.unit.id && isOpen(t));
  const broadcast = broadcasts[0];

  return (
    <>
      <RealtimeRefresh
        channel={`home-${tenant.unit.id}`}
        watch={[
          { table: "tickets", filter: `building_id=eq.${tenant.building.id}` },
          { table: "broadcasts", filter: `building_id=eq.${tenant.building.id}` },
        ]}
      />
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] text-muted-foreground">
            {tenant.building.name} · Flat {tenant.unit.number}
          </span>
          <h1 className="text-[26px] leading-8 font-bold tracking-[-0.01em]">Hi {tenant.name.split(" ")[0]}</h1>
        </div>
        <span aria-hidden className="flex size-10 items-center justify-center rounded-full bg-primary-soft font-bold text-primary-hover">
          {tenant.name[0]}
        </span>
      </header>

      {broadcast && (
        <div className="flex gap-3 rounded-xl bg-primary-soft px-4 py-3.5 text-[#0A3B31]">
          <Megaphone className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} aria-hidden />
          <div className="flex flex-col gap-1">
            <span className="label-caps">From your landlord · {timeAgo(broadcast.created_at)}</span>
            <p className="text-[15px] leading-[22px]">{broadcast.text}</p>
          </div>
        </div>
      )}

      {buildingWide.map((t) => (
        <Card key={t.id} className="flex flex-col gap-2.5 px-4 py-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[15px] font-semibold">
              <IssueIcon type={t.issue_type} className="size-[18px] text-high" />
              {t.issue_type ? ISSUE_LABEL[t.issue_type] : "Issue"} · whole building
            </span>
            <span className="text-[13px] text-muted-foreground">Known issue</span>
          </div>
          <ProgressTracker status={t.status} />
          <p className="text-sm text-muted-foreground">We know about this. No need to report it.</p>
        </Card>
      ))}

      <section className="flex flex-col gap-3">
        <SectionLabel>My tickets</SectionLabel>
        {mine.length === 0 ? (
          <Card className="px-4 py-6 text-center text-muted-foreground">Nothing open. If something breaks, tell us below.</Card>
        ) : (
          mine.map((t) => <TenantTicketCard key={t.id} ticket={t} />)
        )}
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Link
          href="/app/new"
          className="flex min-h-24 flex-col items-start justify-between rounded-2xl bg-primary p-4 text-primary-foreground hover:bg-primary-hover"
        >
          <Camera className="size-6" strokeWidth={1.75} aria-hidden />
          <span className="font-semibold">Take a photo</span>
        </Link>
        <Link
          href="/app/new"
          className="flex min-h-24 flex-col items-start justify-between rounded-2xl border border-border bg-card p-4 hover:bg-muted"
        >
          <Mic className="size-6" strokeWidth={1.75} aria-hidden />
          <span className="font-semibold">Record a voice memo</span>
        </Link>
      </section>
    </>
  );
}
