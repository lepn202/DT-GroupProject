import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { SignUpForm } from "./signup-form";

export default function SignUpPage() {
  return (
    <AuthShell title="Create your landlord account" subtitle="One account for your whole portfolio. You'll add your first building next.">
      <SignUpForm />
      <p className="text-sm text-muted-foreground">
        Already have an account? <Link href="/login" className="font-semibold text-primary underline-offset-2 hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}
