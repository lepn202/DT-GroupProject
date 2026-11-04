"use client";

import { useActionState } from "react";
import { ErrorNote } from "@/components/ui";
import { signInAsDemo, type FormState } from "@/lib/actions/auth";

const ACCOUNTS = [
  { email: "markus@demo.test", label: "Markus", role: "Landlord · 3 buildings" },
  { email: "mara@demo.test", label: "Mara", role: "Tenant · Alexanderplatz 1, 4B" },
  { email: "jonas@demo.test", label: "Jonas", role: "Tenant · 4A (same floor as Mara)" },
  { email: "sofia@demo.test", label: "Sofia", role: "Tenant · 2B" },
  { email: "paul@demo.test", label: "Paul", role: "Tenant · 1B (below Sofia)" },
  { email: "nina@demo.test", label: "Nina", role: "Tenant · Kastanienallee 12, 2A" },
];

/** Test accounts for trying the app (demo mode only). Password for all: demo-password. */
export function DemoAccounts() {
  const [state, action] = useActionState(async (_: FormState, form: FormData) => signInAsDemo(String(form.get("email"))), undefined);
  return (
    <section aria-labelledby="demo-accounts" className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-4">
      <div className="flex flex-col gap-0.5">
        <h2 id="demo-accounts" className="label-caps text-muted-foreground">
          Test accounts
        </h2>
        <p className="text-sm text-muted-foreground">
          One tap to sign in. Or use the email with the password <span className="font-mono">demo-password</span>.
        </p>
      </div>
      <form action={action} className="grid gap-2 sm:grid-cols-2">
        {ACCOUNTS.map((a) => (
          <button
            key={a.email}
            name="email"
            value={a.email}
            className="flex min-h-11 flex-col items-start rounded-lg border border-border bg-card px-3 py-2 text-left hover:border-primary/50 hover:bg-muted"
          >
            <span className="text-sm font-semibold">{a.label}</span>
            <span className="text-xs text-muted-foreground">{a.role}</span>
          </button>
        ))}
      </form>
      <ErrorNote>{state?.error}</ErrorNote>
    </section>
  );
}
