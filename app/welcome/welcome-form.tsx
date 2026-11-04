"use client";

import { useActionState } from "react";
import { ErrorNote, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { finishLandlordSetup } from "@/lib/actions/auth";

export function WelcomeForm() {
  const [state, action] = useActionState(finishLandlordSetup, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Your name" hint="You'll manage your buildings as a landlord">
        <Input name="name" autoComplete="name" required />
      </Field>
      <ErrorNote>{state?.error}</ErrorNote>
      <SubmitButton pendingText="Setting up…">Continue as landlord</SubmitButton>
    </form>
  );
}
