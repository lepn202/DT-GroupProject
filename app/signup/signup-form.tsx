"use client";

import { useActionState } from "react";
import { ErrorNote, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { signUpLandlord } from "@/lib/actions/auth";

export function SignUpForm() {
  const [state, action] = useActionState(signUpLandlord, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Your name">
        <Input name="name" autoComplete="name" required />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" hint="At least 8 characters">
        <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <ErrorNote>{state?.error}</ErrorNote>
      <SubmitButton pendingText="Creating account…">Create account</SubmitButton>
    </form>
  );
}
