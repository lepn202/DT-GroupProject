import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Page, PageHeader } from "@/components/dashboard-ui";
import { Button, Card, SectionLabel } from "@/components/ui";
import { regenerateInvite } from "@/lib/actions/landlord";
import { requireLandlord } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CopyButton } from "./copy-button";

export default async function InvitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireLandlord();
  const supabase = await createClient();
  const { data: building } = await supabase.from("buildings").select("id, name, invite_code").eq("id", id).maybeSingle();
  if (!building) notFound();

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const link = `${origin}/join/${building.invite_code}`;

  return (
    <Page className="max-w-2xl">
      <PageHeader
        crumbs={
          <>
            <Link href={`/dashboard/buildings/${id}`} className="hover:underline">
              {building.name}
            </Link>{" "}
            / Invite
          </>
        }
        title="Invite tenants"
        subtitle="Share this link with the tenants of this building. They pick their flat and create an account."
      />
      <Card className="flex flex-col gap-4 p-5">
        <SectionLabel>Invite link</SectionLabel>
        <div className="flex flex-col gap-2 sm:flex-row">
          <code className="flex min-h-11 flex-1 items-center overflow-x-auto rounded-md border border-border bg-muted px-3 font-mono text-sm">{link}</code>
          <CopyButton value={link} />
        </div>
        <SectionLabel>Code</SectionLabel>
        <span className="font-mono text-[28px] font-semibold tracking-widest">{building.invite_code}</span>
        <form action={regenerateInvite.bind(null, id)}>
          <Button variant="ghost" className="px-0 text-sm text-muted-foreground">
            Make a new code (the old link stops working)
          </Button>
        </form>
      </Card>
    </Page>
  );
}
