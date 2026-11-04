import Link from "next/link";
import { Page, PageHeader } from "@/components/dashboard-ui";
import { IssueIcon } from "@/components/ticket-ui";
import { Button, Card, Select } from "@/components/ui";
import { requireLandlord } from "@/lib/auth";
import { formatDate, ISSUE_LABEL, ISSUE_TYPES, ticketTitle, type Ticket } from "@/lib/domain";
import { landlordBuildings } from "@/lib/landlord-data";
import { createClient } from "@/lib/supabase/server";

export default async function ArchivePage({ searchParams }: { searchParams: Promise<{ building?: string; issue?: string }> }) {
  await requireLandlord();
  const { building, issue } = await searchParams;
  const supabase = await createClient();
  const buildings = await landlordBuildings();
  let q = supabase
    .from("tickets")
    .select("*, building:buildings(name), unit:units(number)")
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false })
    .limit(200);
  if (building) q = q.eq("building_id", building);
  if (issue && (ISSUE_TYPES as readonly string[]).includes(issue)) q = q.eq("issue_type", issue);
  const { data } = await q;
  const tickets = (data ?? []) as (Ticket & { building: { name: string }; unit: { number: string } | null })[];

  return (
    <Page>
      <PageHeader title="Archive" subtitle="Dismissed tickets, kept for reference." />
      <form className="flex flex-col gap-2 sm:flex-row" role="search">
        <Select name="building" defaultValue={building ?? ""} aria-label="Building" className="sm:w-60">
          <option value="">All buildings</option>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
        <Select name="issue" defaultValue={issue ?? ""} aria-label="Issue type" className="sm:w-48">
          <option value="">All issue types</option>
          {ISSUE_TYPES.map((t) => (
            <option key={t} value={t}>
              {ISSUE_LABEL[t]}
            </option>
          ))}
        </Select>
        <Button variant="secondary" type="submit">
          Filter
        </Button>
      </form>
      {tickets.length === 0 ? (
        <Card className="px-5 py-8 text-center text-muted-foreground">Nothing in the archive yet. Dismiss resolved tickets from a building view to move them here.</Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link href={`/dashboard/tickets/${t.id}`}>
                <Card className="flex items-center gap-3 px-5 py-3 hover:border-primary/40">
                  <IssueIcon type={t.issue_type} className="text-muted-foreground" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold">{ticketTitle(t)}</span>
                    <span className="truncate text-sm text-muted-foreground">
                      {t.building.name} · {t.scope === "building" ? "Whole building" : `Flat ${t.unit?.number ?? "?"}`} · {t.summary}
                    </span>
                  </div>
                  <span className="font-mono text-[13px] text-muted-foreground">{formatDate(t.archived_at!)}</span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
