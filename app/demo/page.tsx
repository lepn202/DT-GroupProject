import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Smartphone } from "lucide-react";
import { Page, PageHeader } from "@/components/dashboard-ui";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Card, SectionLabel } from "@/components/ui";
import { requireLandlord } from "@/lib/auth";
import { demoEnabled } from "@/lib/config";
import { formatDateTime, timeAgo } from "@/lib/domain";
import { PRESET_OPTIONS } from "@/lib/sensors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { FireForm, RemindersForm } from "./fire-form";

// Demo panel (architecture §5.1): one sensor_event per click. Landlord accounts only, hidden in production.
export default async function DemoPage() {
  const landlord = await requireLandlord();
  if (!demoEnabled()) notFound();
  const supabase = await createClient();

  const [{ data: buildings }, { data: tenants }, { data: events }] = await Promise.all([
    supabase.from("buildings").select("id, name, units(id, number, floor, position)").order("name"),
    supabase.from("tenants").select("id, name, unit_id"),
    supabase
      .from("sensor_events")
      .select("id, preset, metric, details, confirmation, ticket_id, reported_at, unit:units(number, building:buildings(name))")
      .order("reported_at", { ascending: false })
      .limit(12),
  ]);
  const tenantOf = new Map((tenants ?? []).map((t) => [t.unit_id, t.name.split(" ")[0]]));
  const options = (buildings ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    units: (b.units as { id: string; number: string; floor: number; position: string }[])
      .sort((x, y) => x.floor - y.floor || x.position.localeCompare(y.position))
      .map((u) => ({ id: u.id, number: u.number, tenant: tenantOf.get(u.id) ?? null })),
  }));

  // Outbox: what this landlord's buildings sent (in-app and email), including to technicians.
  const admin = createAdminClient();
  const tenantIds = (tenants ?? []).map((t) => t.id);
  const { data: outbox } = await admin
    .from("notifications")
    .select("id, channel, kind, email, title, delivered, created_at, tenant:tenants(name), technician:technicians(name)")
    .or([`landlord_id.eq.${landlord.id}`, tenantIds.length ? `tenant_id.in.(${tenantIds.join(",")})` : "", "technician_id.not.is.null"].filter(Boolean).join(","))
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <Page>
      <RealtimeRefresh channel={`demo-${landlord.id}`} watch={[{ table: "sensor_events" }, { table: "tickets" }, { table: "notifications", filter: `landlord_id=eq.${landlord.id}` }]} />
      <PageHeader title="Demo panel" subtitle="Simulated sensors: each click inserts one sensor event that is already an anomaly. Hidden in production." />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-6">
          <Card className="p-5">
            <FireForm buildings={options} presets={PRESET_OPTIONS} />
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <SectionLabel>Recent sensor events</SectionLabel>
            {!events?.length && <p className="text-sm text-muted-foreground">None yet.</p>}
            <ul className="divide-y divide-border">
              {events?.map((e) => {
                const unit = e.unit as unknown as { number: string; building: { name: string } };
                return (
                  <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
                    <span className="w-12 font-mono font-semibold">{unit.number}</span>
                    <span className="min-w-0 flex-1">
                      {e.details} <span className="text-muted-foreground">· {unit.building.name}</span>
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold",
                        e.confirmation === "yes" ? "bg-primary-soft text-primary-hover" : e.confirmation === "no" ? "bg-muted text-muted-foreground" : "bg-medium-tint text-medium-text",
                      )}
                    >
                      {e.confirmation === "pending" ? "waiting for tenant" : e.confirmation === "yes" ? "confirmed" : "dismissed"}
                    </span>
                    {e.ticket_id ? (
                      <Link href={`/dashboard/tickets/${e.ticket_id}`} className="font-semibold text-primary hover:underline">
                        Ticket
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">no ticket</span>
                    )}
                    <span className="font-mono text-xs text-muted-foreground">{timeAgo(e.reported_at)}</span>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <SectionLabel>Appointment reminders</SectionLabel>
            <p className="text-sm text-muted-foreground">In production Supabase Cron calls /api/cron/reminders every 15 minutes.</p>
            <RemindersForm />
          </Card>
        </div>

        <Card className="flex flex-col gap-3 self-start p-5">
          <SectionLabel>Outbox</SectionLabel>
          <p className="text-sm text-muted-foreground">
            In-app notices and emails, newest first. {process.env.RESEND_API_KEY ? "Emails go out through Resend." : "No email provider set (RESEND_API_KEY), so emails are only logged."}
          </p>
          <ul className="flex flex-col gap-2.5">
            {outbox?.map((n) => {
              const who =
                (n.tenant as unknown as { name: string } | null)?.name ??
                (n.technician as unknown as { name: string } | null)?.name ??
                (n.email ? n.email : "You");
              return (
                <li key={n.id} className="flex gap-2.5 text-sm">
                  {n.channel === "email" ? (
                    <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Email" />
                  ) : (
                    <Smartphone className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="In-app" />
                  )}
                  <div className="flex min-w-0 flex-col">
                    <span className="font-semibold">{n.title}</span>
                    <span className="text-xs text-muted-foreground">
                      To {who} · <span className="font-mono">{formatDateTime(n.created_at)}</span>
                      {n.channel === "email" && !n.delivered ? " · logged only" : ""}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </Page>
  );
}
