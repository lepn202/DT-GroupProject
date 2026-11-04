import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleHelp } from "lucide-react";
import { KpiTile, Page, PageHeader } from "@/components/dashboard-ui";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { DueTag, StageChip, UrgencyBadge } from "@/components/ticket-ui";
import { Button, ButtonLink, Card, SectionLabel } from "@/components/ui";
import { dismissTicket } from "@/lib/actions/landlord";
import { requireLandlord } from "@/lib/auth";
import { compareTickets, formatSlot, isOpen, TRADE_LABEL, ticketTitle, type Ticket } from "@/lib/domain";
import { computeKpis, landlordTickets } from "@/lib/landlord-data";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { BroadcastForm } from "../../broadcast-form";

type Row = Ticket & { unit: { number: string } | null };

export default async function BuildingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireLandlord();
  const supabase = await createClient();
  const { data: building } = await supabase.from("buildings").select("id, name, address, units(count)").eq("id", id).maybeSingle();
  if (!building) notFound();
  const unitCount = (building.units as unknown as { count: number }[])[0]?.count ?? 0;

  const tickets = (await landlordTickets(id)) as Row[];
  tickets.sort(compareTickets);
  const ids = tickets.map((t) => t.id);
  const [{ data: reports }, { data: appointments }, { data: tenants }, { data: children }] = await Promise.all([
    ids.length ? supabase.from("reports").select("ticket_id, source, transcript, media_paths").in("ticket_id", ids) : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from("appointments").select("ticket_id, starts_at, ends_at, status, technician:technicians(trade)").in("ticket_id", ids).in("status", ["proposed", "booked"])
      : Promise.resolve({ data: [] }),
    supabase.from("tenants").select("id, name, phone, email, unit:units!inner(number, building_id)").eq("unit.building_id", id),
    ids.length ? supabase.from("tickets").select("parent_ticket_id, unit:units(number)").in("parent_ticket_id", ids) : Promise.resolve({ data: [] }),
  ]);
  function linkedFlats(ticketId: string) {
    return (children ?? [])
      .filter((c) => c.parent_ticket_id === ticketId)
      .map((c) => (c.unit as unknown as { number: string } | null)?.number)
      .filter(Boolean) as string[];
  }

  const kpis = computeKpis(tickets);

  function source(ticketId: string) {
    const rs = (reports ?? []).filter((r) => r.ticket_id === ticketId);
    if (!rs.length) return "";
    if (rs.some((r) => r.source === "sensor")) return rs.length > 1 ? `sensor + ${rs.length - 1} report(s)` : "sensor, confirmed";
    const parts = new Set<string>();
    for (const r of rs) {
      if (r.transcript) parts.add("voice memo");
      for (const p of r.media_paths as string[]) parts.add(/\.(jpe?g|png)$/i.test(p) ? "photo" : "video");
    }
    return parts.size ? [...parts].join(" + ") : "text";
  }

  function appointment(t: Row) {
    const a = (appointments ?? []).find((x) => x.ticket_id === t.id);
    if (a) {
      const trade = (a.technician as unknown as { trade: keyof typeof TRADE_LABEL } | null)?.trade;
      return `${formatSlot(a.starts_at, a.ends_at)}${trade ? ` · ${TRADE_LABEL[trade].toLowerCase()}` : ""}${a.status === "proposed" ? " (confirm)" : ""}`;
    }
    if (!isOpen(t)) return "—";
    if (!t.classified_by) return "Classifying…";
    if (t.urgency === "emergency" && t.next_step === "schedule_technician") return "Book now";
    if (t.needs_windows) return "Needs more tenant times";
    if (t.next_step === "schedule_technician") return "Awaiting tenant slots";
    if (t.next_step === "inform_landlord") return "Next planned visit";
    if (t.next_step === "quick_fix") return "Quick fix sent";
    return "—";
  }

  return (
    <div className="flex flex-1 flex-col">
      <RealtimeRefresh channel={`building-${id}`} watch={[{ table: "tickets", filter: `building_id=eq.${id}` }, { table: "appointments" }]} />
      <Page className="flex-1">
        <PageHeader
          crumbs={
            <>
              <Link href="/dashboard" className="hover:underline">
                Portfolio
              </Link>{" "}
              / Building
            </>
          }
          title={building.name}
          subtitle={`${building.address} · ${unitCount} units`}
          actions={
            <ButtonLink href={`/dashboard/buildings/${id}/invite`} variant="secondary">
              Invite tenants
            </ButtonLink>
          }
        />

        <section aria-label="KPIs" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile
            main
            label="Time from issue to fix"
            value={kpis.medianFixDays == null ? "—" : `${kpis.medianFixDays.toFixed(1)} d`}
            note="Main KPI · median, 30 days"
          />
          <KpiTile label="Open / resolved" value={`${kpis.open} / ${kpis.resolved}`} note="This building" />
          <KpiTile label="Overdue" value={kpis.overdue} note="Past target time" tone={kpis.overdue > 0 ? "alert" : undefined} />
          <KpiTile
            label="Handled without you"
            value={kpis.handledWithoutLandlord == null ? "—" : `${kpis.handledWithoutLandlord} %`}
            note="No landlord action needed"
          />
        </section>

        <section aria-label="Pipeline" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Logged", kpis.stages.logged, "border-[1.5px] border-stage-logged"],
            ["Booked", kpis.stages.booked, "bg-stage-booked"],
            ["In progress", kpis.stages.inProgress, "bg-stage-progress"],
            ["Resolved", kpis.stages.resolved, "bg-primary"],
          ].map(([label, count, dot]) => (
            <div key={label as string} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-medium">
                <span className={cn("size-2.5 rounded-full", dot as string)} aria-hidden />
                {label}
              </span>
              <span className="font-mono font-semibold">{count}</span>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">Problems</h2>
            <span className="text-sm text-muted-foreground">Ranked by urgency, then due time</span>
          </div>
          {tickets.length === 0 ? (
            <Card className="px-5 py-8 text-center text-muted-foreground">No problems reported. Tickets appear here as soon as tenants or sensors report them.</Card>
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="label-caps px-4 py-3 font-semibold">Urgency</th>
                    <th className="label-caps px-4 py-3 font-semibold">Issue</th>
                    <th className="label-caps px-4 py-3 font-semibold">Stage</th>
                    <th className="label-caps px-4 py-3 font-semibold">Appointment</th>
                    <th className="label-caps px-4 py-3 font-semibold">Due</th>
                    <th className="px-4 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => {
                    const resolved = !isOpen(t);
                    return (
                      <tr key={t.id} className={cn("border-b border-border last:border-0", resolved && "text-muted-foreground", t.urgency === "emergency" && !resolved && "bg-emergency-tint/40")}>
                        <td className="px-4 py-3 align-top">
                          <UrgencyBadge urgency={t.urgency} className={resolved ? "opacity-60" : ""} />
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Link href={`/dashboard/tickets/${t.id}`} className="font-semibold text-foreground hover:underline">
                            {t.classified_by ? ticketTitle(t) : "New report"}
                          </Link>
                          <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                            {t.scope === "building"
                              ? `Whole building${linkedFlats(t.id).length ? ` · flats ${linkedFlats(t.id).sort().join(", ")}` : ""}`
                              : `Flat ${t.unit?.number ?? "?"}${linkedFlats(t.id).length ? ` + ${linkedFlats(t.id).length} linked report(s)` : ""}`}
                            {source(t.id) && <> · {source(t.id)}</>}
                            {t.needs_triage && isOpen(t) && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-medium-tint px-2 py-0.5 text-xs font-semibold text-medium-text">
                                <CircleHelp className="size-3" aria-hidden /> Needs triage
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <StageChip status={t.status} />
                        </td>
                        <td className={cn("px-4 py-3 align-top", appointment(t) === "Book now" && "font-semibold text-emergency-text", appointment(t) === "Needs more tenant times" && "font-semibold text-medium-text")}>
                          {appointment(t) === "Book now" ? (
                            <Link href={`/dashboard/tickets/${t.id}`} className="underline">
                              Book now
                            </Link>
                          ) : (
                            appointment(t)
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <DueTag ticket={t} />
                        </td>
                        <td className="px-4 py-3 text-right align-top">
                          {resolved && (
                            <form action={dismissTicket.bind(null, t.id)}>
                              <Button variant="ghost" className="min-h-9 px-3 text-sm">
                                Dismiss
                              </Button>
                            </form>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </section>

        <details className="rounded-xl border border-border bg-card">
          <summary className="flex min-h-12 cursor-pointer items-center px-5 font-semibold">Tenants ({tenants?.length ?? 0})</summary>
          <ul className="divide-y divide-border border-t border-border">
            {(tenants ?? [])
              .map((t) => ({ ...t, unit: t.unit as unknown as { number: string } }))
              .sort((a, b) => a.unit.number.localeCompare(b.unit.number))
              .map((t) => (
                <li key={t.id} className="flex flex-wrap gap-x-6 gap-y-1 px-5 py-3 text-sm">
                  <span className="w-12 font-mono font-semibold">{t.unit.number}</span>
                  <span className="flex-1">{t.name}</span>
                  <span className="text-muted-foreground">{t.phone}</span>
                  <span className="text-muted-foreground">{t.email}</span>
                </li>
              ))}
          </ul>
        </details>
      </Page>

      <div className="sticky bottom-0 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-1">
          <SectionLabel>Message all tenants</SectionLabel>
          <BroadcastForm fixedBuildingId={id} />
        </div>
      </div>
    </div>
  );
}
