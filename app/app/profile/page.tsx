import { Building2 } from "lucide-react";
import { Button, Card, SectionLabel } from "@/components/ui";
import { signOut } from "@/lib/actions/auth";
import { requireTenant } from "@/lib/auth";
import { PasswordForm, ProfileForm } from "./forms";

export default async function ProfilePage() {
  const tenant = await requireTenant();
  return (
    <>
      <h1 className="text-[28px] leading-[34px] font-bold tracking-[-0.01em]">Profile</h1>
      <Card className="flex items-center gap-3 p-4">
        <Building2 className="size-6 text-primary" strokeWidth={1.75} aria-hidden />
        <div className="flex flex-col">
          <span className="font-semibold">
            {tenant.building.name} · Flat {tenant.unit.number}
          </span>
          <span className="text-sm text-muted-foreground">{tenant.building.address}</span>
        </div>
      </Card>
      <section className="flex flex-col gap-3">
        <SectionLabel>Your details</SectionLabel>
        <p className="text-sm text-muted-foreground">{tenant.email}</p>
        <ProfileForm name={tenant.name} phone={tenant.phone} />
      </section>
      <section className="flex flex-col gap-3">
        <SectionLabel>Password</SectionLabel>
        <PasswordForm />
      </section>
      <form action={signOut}>
        <Button variant="secondary" className="w-full">
          Sign out
        </Button>
      </form>
    </>
  );
}
