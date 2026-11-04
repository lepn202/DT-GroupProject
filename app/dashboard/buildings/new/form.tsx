"use client";

import { useActionState } from "react";
import { Card, ErrorNote, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createBuilding } from "@/lib/actions/landlord";

export function NewBuildingForm() {
  const [state, action] = useActionState(createBuilding, undefined);
  return (
    <Card className="p-5">
      <form action={action} className="flex flex-col gap-4">
        <Field label="Name" hint="Shown on your dashboard, e.g. Alexanderplatz 1">
          <Input name="name" required />
        </Field>
        <Field label="Address">
          <Input name="address" autoComplete="street-address" required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Floors">
            <Input name="floors" type="number" min={1} max={40} defaultValue={4} required />
          </Field>
          <Field label="Flats per floor" hint="Numbered 1A, 1B, …">
            <Input name="perFloor" type="number" min={1} max={12} defaultValue={4} required />
          </Field>
        </div>
        <ErrorNote>{state?.error}</ErrorNote>
        <SubmitButton pendingText="Saving…" className="self-start">
          Add building
        </SubmitButton>
      </form>
    </Card>
  );
}
