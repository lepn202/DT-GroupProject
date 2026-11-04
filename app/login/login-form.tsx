"use client";

import { useActionState } from "react";
import { ErrorNote, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { signIn } from "@/lib/actions/auth";

export function LoginForm() {
  const [state, action] = useActionState(signIn, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <ErrorNote>{state?.error}</ErrorNote>
      <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
    </form>
  );
}
