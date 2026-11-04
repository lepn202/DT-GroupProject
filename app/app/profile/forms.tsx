"use client";

import { useActionState } from "react";
import { ErrorNote, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { changePassword, updateProfile } from "@/lib/actions/tenant";

export function ProfileForm({ name, phone }: { name: string; phone: string }) {
  const [state, action] = useActionState(updateProfile, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field label="Name">
        <Input name="name" defaultValue={name} required />
      </Field>
      <Field label="Phone">
        <Input name="phone" type="tel" defaultValue={phone} required />
      </Field>
      <ErrorNote>{state?.error}</ErrorNote>
      {state?.ok && <p className="text-sm text-primary">{state.ok}</p>}
      <SubmitButton variant="secondary" pendingText="Saving…">
        Save details
      </SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field label="New password" hint="At least 8 characters">
        <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <ErrorNote>{state?.error}</ErrorNote>
      {state?.ok && <p className="text-sm text-primary">{state.ok}</p>}
      <SubmitButton variant="secondary" pendingText="Saving…">
        Change password
      </SubmitButton>
    </form>
  );
}
