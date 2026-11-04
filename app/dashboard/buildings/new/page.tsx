import { Page, PageHeader } from "@/components/dashboard-ui";
import { requireLandlord } from "@/lib/auth";
import { NewBuildingForm } from "./form";

export default async function NewBuildingPage() {
  await requireLandlord();
  return (
    <Page className="max-w-2xl">
      <PageHeader title="Add a building" subtitle="We'll create its flats and an invite link for your tenants." />
      <NewBuildingForm />
    </Page>
  );
}
