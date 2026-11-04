import { Page, PageHeader } from "@/components/dashboard-ui";
import { requireLandlord } from "@/lib/auth";
import { DEFAULT_DUE_HOURS } from "@/lib/domain";
import { Card, SectionLabel } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { GuidesForm } from "./guides-form";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const landlord = await requireLandlord();
  const supabase = await createClient();
  const { data: buildings } = await supabase.from("buildings").select("id, name, quick_fix_guides").order("name");
  return (
    <Page className="max-w-3xl">
      <PageHeader title="Settings" />
      <SettingsForm
        mode={landlord.mode}
        dueHours={{ ...DEFAULT_DUE_HOURS, ...(landlord.due_hours as Partial<typeof DEFAULT_DUE_HOURS>) }}
        stats={landlord.portfolio_stats}
      />
      <Card className="flex flex-col gap-4 p-5">
        <SectionLabel>Quick-fix guides per building</SectionLabel>
        <p className="text-sm text-muted-foreground">
          The chatbot in the tenant app uses these first: where the radiator key is, how your fuse box works. Plain text or markdown, one section per topic.
        </p>
        {(buildings ?? []).map((b) => (
          <GuidesForm key={b.id} buildingId={b.id} name={b.name} guides={b.quick_fix_guides} />
        ))}
      </Card>
    </Page>
  );
}
