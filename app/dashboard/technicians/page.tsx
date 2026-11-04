import { Page, PageHeader } from "@/components/dashboard-ui";
import { Button, Card, SectionLabel } from "@/components/ui";
import { addTechnician, removeTechnician, resendTechnicianLink, updateTechnician } from "@/lib/actions/landlord";
import { requireLandlord } from "@/lib/auth";
import { TRADE_LABEL, type Trade } from "@/lib/domain";
import { appUrl } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { TechnicianForm } from "./technician-form";

type Tech = { id: string; landlord_id: string | null; name: string; trade: Exclude<Trade, "none">; email: string; phone: string; link_token: string };

// Technicians (architecture §5.8): the landlord's own technicians (used first when booking)
// and a read-only view of the shared pool.
export default async function TechniciansPage() {
  const landlord = await requireLandlord();
  const supabase = await createClient();
  const { data } = await supabase.from("technicians").select("id, landlord_id, name, trade, email, phone").is("removed_at", null).order("trade").order("name");
  // Link tokens are never readable by signed-in users; only the landlord's own are shown, read server-side.
  const { data: tokens } = await createAdminClient().from("technicians").select("id, link_token").eq("landlord_id", landlord.id);
  const tokenOf = new Map((tokens ?? []).map((t) => [t.id, t.link_token as string]));
  const techs = (data ?? []).map((t) => ({ ...t, link_token: tokenOf.get(t.id) ?? "" })) as Tech[];
  const own = techs.filter((t) => t.landlord_id === landlord.id);
  const pool = techs.filter((t) => t.landlord_id === null);

  return (
    <Page className="max-w-4xl">
      <PageHeader title="Technicians" subtitle="Bookings try your own technicians first, then the shared pool." />

      <section className="flex flex-col gap-3">
        <SectionLabel>Your technicians</SectionLabel>
        {own.length === 0 && <Card className="px-5 py-6 text-muted-foreground">None yet. Add the tradespeople you already work with below.</Card>}
        {own.map((t) => (
          <Card key={t.id} className="flex flex-col gap-3 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold">{t.name}</span>
                <span className="text-sm text-muted-foreground">
                  {TRADE_LABEL[t.trade]} · {t.email} · {t.phone}
                </span>
                <a href={appUrl(`/t/${t.link_token}`)} className="text-sm text-primary hover:underline" target="_blank" rel="noreferrer">
                  Their link page
                </a>
              </div>
              <div className="flex flex-wrap gap-2">
                <form action={resendTechnicianLink.bind(null, t.id)}>
                  <Button variant="secondary">Resend link</Button>
                </form>
                <form action={removeTechnician.bind(null, t.id)}>
                  <Button variant="ghost" className="text-emergency-text">
                    Remove
                  </Button>
                </form>
              </div>
            </div>
            <details>
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">Edit details</summary>
              <div className="pt-2">
                <TechnicianForm action={updateTechnician.bind(null, t.id)} initial={t} submitLabel="Save" />
              </div>
            </details>
          </Card>
        ))}
      </section>

      <Card className="flex flex-col gap-3 p-5">
        <SectionLabel>Add a technician</SectionLabel>
        <p className="text-sm text-muted-foreground">They don&apos;t need an account. We email them a private link where they see their jobs and set when they&apos;re free.</p>
        <TechnicianForm action={addTechnician} submitLabel="Add technician" />
      </Card>

      <section className="flex flex-col gap-3">
        <SectionLabel>Shared pool</SectionLabel>
        <Card className="divide-y divide-border">
          {pool.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <span className="font-semibold">{t.name}</span>
              <span className="text-muted-foreground">{TRADE_LABEL[t.trade]}</span>
            </div>
          ))}
        </Card>
      </section>
    </Page>
  );
}
