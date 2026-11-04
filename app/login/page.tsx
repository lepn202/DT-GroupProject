import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { Notice } from "@/components/ui";
import { getUserId, homeFor } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ confirmed?: string }> }) {
  const { confirmed } = await searchParams;
  if (await getUserId()) {
    const home = await homeFor();
    // Signed in but no landlord or tenant record yet: finish setting up instead of looping back here.
    redirect(home === "/login" ? "/welcome" : home);
  }
  return (
    <AuthShell title="Sign in" subtitle="Landlords and tenants use the same sign-in.">
      {confirmed && <Notice>Your email is confirmed. Sign in to continue.</Notice>}
      <LoginForm />
      <p className="text-sm text-muted-foreground">
        Managing properties? <Link href="/signup" className="font-semibold text-primary underline-offset-2 hover:underline">Create a landlord account</Link>.
        <br />
        Tenant? Use the invite link from your landlord.
      </p>
    </AuthShell>
  );
}
