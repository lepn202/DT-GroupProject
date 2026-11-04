"use client";

import { useActionState } from "react";
import { ErrorNote, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/actions/landlord";

type Values = { name: string; trade: string; email: string; phone: string };

export function TechnicianForm({
  action,
  initial,
  submitLabel,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  initial?: Values;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <Input name="name" defaultValue={initial?.name} required autoComplete="off" />
        </Field>
        <Field label="Trade">
          <Select name="trade" defaultValue={initial?.trade ?? "plumber"}>
            <option value="plumber">Plumber</option>
            <option value="heating">Heating</option>
            <option value="electrician">Electrician</option>
            <option value="handyman">Handyman</option>
          </Select>
        </Field>
        <Field label="Email" hint="Booking emails and their link go here.">
          <Input name="email" type="email" defaultValue={initial?.email} required autoComplete="off" />
        </Field>
        <Field label="Phone">
          <Input name="phone" type="tel" defaultValue={initial?.phone} required autoComplete="off" />
        </Field>
      </div>
      <ErrorNote>{state?.error}</ErrorNote>
      {state?.ok && (
        <p role="status" className="text-sm text-primary">
          {state.ok}
        </p>
      )}
      <SubmitButton pendingText="Saving…" className="self-start">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
