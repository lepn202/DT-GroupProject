import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getUserId, homeFor } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getUserId()) {
    const home = await homeFor();
    if (home !== "/login") redirect(home);
  }
  return (
    <AuthShell title="Sign in" subtitle="Landlords and tenants use the same sign-in.">
      <LoginForm />
      <p className="text-sm text-muted-foreground">
        Managing properties? <Link href="/signup" className="font-semibold text-primary underline-offset-2 hover:underline">Create a landlord account</Link>.
        <br />
        Tenant? Use the invite link from your landlord.
      </p>
    </AuthShell>
  );
}
