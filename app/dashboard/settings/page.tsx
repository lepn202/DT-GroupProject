import { Page, PageHeader } from "@/components/dashboard-ui";
import { requireLandlord } from "@/lib/auth";
import { DEFAULT_DUE_HOURS } from "@/lib/domain";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const landlord = await requireLandlord();
  return (
    <Page className="max-w-3xl">
      <PageHeader title="Settings" />
      <SettingsForm
        mode={landlord.mode}
        dueHours={{ ...DEFAULT_DUE_HOURS, ...(landlord.due_hours as Partial<typeof DEFAULT_DUE_HOURS>) }}
        stats={landlord.portfolio_stats}
      />
    </Page>
  );
}
