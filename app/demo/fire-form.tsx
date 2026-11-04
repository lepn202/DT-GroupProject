"use client";

import { useActionState, useState } from "react";
import { ErrorNote, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { fireDemoEvent, runRemindersNow } from "@/lib/actions/landlord";

type Building = { id: string; name: string; units: { id: string; number: string; tenant: string | null }[] };
type Preset = { key: string; label: string; hint: string };

export function FireForm({ buildings, presets }: { buildings: Building[]; presets: Preset[] }) {
  const [state, action] = useActionState(fireDemoEvent, undefined);
  const [buildingId, setBuildingId] = useState(buildings[0]?.id ?? "");
  const building = buildings.find((b) => b.id === buildingId);
  const defaultUnit = building?.units.find((u) => u.number === "4B") ?? building?.units[0];

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Building</span>
          <Select value={buildingId} onChange={(e) => setBuildingId(e.target.value)}>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Flat</span>
          <Select key={buildingId} name="unit_id" defaultValue={defaultUnit?.id}>
            {building?.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.number}
                {u.tenant ? ` · ${u.tenant}` : " · no tenant"}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Preset</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {presets.map((p, i) => (
            <label
              key={p.key}
              className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
            >
              <input type="radio" name="preset" value={p.key} defaultChecked={i === 0} className="mt-1 accent-[var(--primary)]" />
              <span className="flex flex-col">
                <span className="font-semibold">{p.label}</span>
                <span className="text-sm text-muted-foreground">{p.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <ErrorNote>{state?.error}</ErrorNote>
      {state?.ok && (
        <p role="status" className="text-sm font-semibold text-primary">
          {state.ok}
        </p>
      )}
      <SubmitButton pendingText="Firing…" className="self-start">
        Fire sensor event
      </SubmitButton>
    </form>
  );
}

export function RemindersForm() {
  const [state, action] = useActionState(runRemindersNow, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" name="force" defaultChecked className="size-4 accent-[var(--primary)]" />
        Don&apos;t wait: send the next reminder for every visit in the next 48 h
      </label>
      {state?.ok && (
        <p role="status" className="text-sm font-semibold text-primary">
          {state.ok}
        </p>
      )}
      <SubmitButton variant="secondary" pendingText="Sending…" className="self-start">
        Send reminders
      </SubmitButton>
    </form>
  );
}
