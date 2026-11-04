"use client";

import { useActionState } from "react";
import { ErrorNote, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { joinBuilding } from "@/lib/actions/auth";

export function JoinForm({ code, units }: { code: string; units: { id: string; number: string; floor: number }[] }) {
  const [state, action] = useActionState(joinBuilding, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="code" value={code} />
      <Field label="Your apartment">
        <Select name="unit" required defaultValue="">
          <option value="" disabled>
            Choose your flat
          </option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              Flat {u.number} · floor {u.floor}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Your name">
        <Input name="name" autoComplete="name" required />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Phone number" hint="So the technician can reach you on the day">
        <Input name="phone" type="tel" autoComplete="tel" required />
      </Field>
      <Field label="Password" hint="At least 8 characters">
        <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <ErrorNote>{state?.error}</ErrorNote>
      <SubmitButton pendingText="Creating account…">Create account</SubmitButton>
    </form>
  );
}
