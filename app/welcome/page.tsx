import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui";
import { signOut } from "@/lib/actions/auth";
import { getUserId, homeFor } from "@/lib/auth";
import { WelcomeForm } from "./welcome-form";

// A signed-in user with no landlord or tenant record lands here instead of looping
// back to the login page.
export default async function WelcomePage() {
  if (!(await getUserId())) redirect("/login");
  const home = await homeFor();
  if (home !== "/login") redirect(home);

  return (
    <AuthShell title="Finish setting up" subtitle="Your email is confirmed. One more step before you can use your account.">
      <WelcomeForm />
      <p className="text-sm text-muted-foreground">
        Are you a tenant? You don&apos;t need this. Open the invite link from your landlord instead.
      </p>
      <form action={signOut}>
        <Button variant="ghost" className="px-0 text-sm text-muted-foreground">
          Sign out
        </Button>
      </form>
    </AuthShell>
  );
}
