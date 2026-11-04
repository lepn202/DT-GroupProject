import Link from "next/link";
import { ChevronRight, TriangleAlert } from "lucide-react";
import { KpiTile, Page, PageHeader } from "@/components/dashboard-ui";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { ButtonLink, Card, SectionLabel } from "@/components/ui";
import { requireLandlord } from "@/lib/auth";
import { computeKpis, landlordBuildings, landlordTickets, type Kpis } from "@/lib/landlord-data";
import { BroadcastForm } from "./broadcast-form";

const STAT: Record<string, { label: string; value: (k: Kpis) => string | number; note: string; alert?: (k: Kpis) => boolean }> = {
  open: { label: "Open", value: (k) => k.open, note: "Across the portfolio" },
  overdue: { label: "Overdue", value: (k) => k.overdue, note: "Past target time", alert: (k) => k.overdue > 0 },
  emergencies: { label: "Emergencies", value: (k) => k.emergencies, note: "Open right now", alert: (k) => k.emergencies > 0 },
  avg_fix_days: {
    label: "Time from issue to fix",
    value: (k) => (k.medianFixDays == null ? "—" : `${k.medianFixDays.toFixed(1)} d`),
    note: "Main KPI · median, 30 days",
  },
  resolved: { label: "Resolved", value: (k) => k.resolved, note: "Not yet dismissed" },
  needs_triage: { label: "Needs triage", value: (k) => k.needsTriage, note: "AI wasn't sure", alert: (k) => k.needsTriage > 0 },
};

// A building is flagged when its open tickets per unit are well above the portfolio average.
const FLAG_FACTOR = 1.5;

export default async function PortfolioPage() {
  const landlord = await requireLandlord();
  const [buildings, tickets] = await Promise.all([landlordBuildings(), landlordTickets()]);
  const kpis = computeKpis(tickets);

  const rows = buildings.map((b) => {
    const own = tickets.filter((t) => t.building_id === b.id);
    return { ...b, kpis: computeKpis(own) };
  });
  const totalUnits = rows.reduce((s, r) => s + r.units, 0);
  const avgOpenPerUnit = totalUnits ? kpis.open / totalUnits : 0;
  const flagged = (r: (typeof rows)[number]) =>
    r.units > 0 && r.kpis.open >= 2 && r.kpis.open / r.units > avgOpenPerUnit * FLAG_FACTOR;

  return (
    <Page>
      <RealtimeRefresh channel="portfolio" watch={[{ table: "tickets" }]} />
      <PageHeader
        title="Portfolio"
        subtitle={`${buildings.length} buildings · ${totalUnits} units`}
        actions={
          <ButtonLink href="/dashboard/buildings/new" variant="secondary">
            Add building
          </ButtonLink>
        }
      />

      <section aria-label="Problem bar" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {landlord.portfolio_stats
          .filter((s) => STAT[s])
          .map((s) => {
            const stat = STAT[s];
            return <KpiTile key={s} label={stat.label} value={stat.value(kpis)} note={stat.note} tone={stat.alert?.(kpis) ? "alert" : undefined} />;
          })}
      </section>
      <p className="-mt-3 text-sm text-muted-foreground">
        Choose which statistics show here in <Link href="/dashboard/settings" className="font-semibold text-primary hover:underline">Settings</Link>.
      </p>

      <section className="flex flex-col gap-3">
        <SectionLabel>Buildings</SectionLabel>
        {rows.length === 0 && (
          <Card className="flex flex-col items-start gap-3 p-6">
            <p>Add your first building to invite tenants.</p>
            <ButtonLink href="/dashboard/buildings/new">Add building</ButtonLink>
          </Card>
        )}
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/dashboard/buildings/${r.id}`} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-primary">
                <Card className="flex flex-col gap-3 px-5 py-4 transition-colors hover:border-primary/40 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2 font-semibold">
                      {r.name}
                      {flagged(r) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-high-tint px-2 py-0.5 text-xs font-semibold text-high-text">
                          <TriangleAlert className="size-3.5" aria-hidden /> Above average
                        </span>
                      )}
                    </span>
                    <span className="truncate text-sm text-muted-foreground">
                      {r.address} · {r.units} units
                    </span>
                  </div>
                  <dl className="grid grid-cols-3 gap-4 text-sm sm:flex sm:gap-8">
                    <Stat label="Open" value={r.kpis.open} />
                    <Stat label="Overdue" value={r.kpis.overdue} alert={r.kpis.overdue > 0} />
                    <Stat label="Resolved" value={r.kpis.resolved} />
                  </dl>
                  <ChevronRight className="hidden size-5 text-muted-foreground sm:block" aria-hidden />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {rows.length > 0 && (
        <Card className="flex flex-col gap-3 p-5">
          <SectionLabel>Message a building</SectionLabel>
          <BroadcastForm buildings={rows.map((r) => ({ id: r.id, name: r.name }))} />
        </Card>
      )}
    </Page>
  );
}

function Stat({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className="flex flex-col">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={alert ? "font-mono font-semibold text-emergency" : "font-mono font-semibold"}>{value}</dd>
    </div>
  );
}
