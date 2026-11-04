"use client";

import { useActionState } from "react";
import { Card, ErrorNote, Input, SectionLabel } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { updateSettings } from "@/lib/actions/landlord";
import { URGENCIES, URGENCY_LABEL, type DueHours } from "@/lib/domain";

const STATS: [string, string][] = [
  ["open", "Open tickets"],
  ["overdue", "Overdue tickets"],
  ["emergencies", "Open emergencies"],
  ["avg_fix_days", "Time from issue to fix"],
  ["resolved", "Resolved, not yet dismissed"],
  ["needs_triage", "Needs triage"],
];

export function SettingsForm({ mode, dueHours, stats }: { mode: "automatic" | "manual"; dueHours: DueHours; stats: string[] }) {
  const [state, action] = useActionState(updateSettings, undefined);
  return (
    <form action={action} className="flex flex-col gap-6">
      <Card className="flex flex-col gap-3 p-5">
        <SectionLabel>Mode</SectionLabel>
        {[
          ["automatic", "Automatic", "The AI books technicians and informs tenants. You only monitor."],
          ["manual", "Manual", "You see every scheduling request and confirm each one before it goes out."],
        ].map(([value, label, hint]) => (
          <label key={value} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
            <input type="radio" name="mode" value={value} defaultChecked={mode === value} className="mt-1 accent-[var(--primary)]" />
            <span className="flex flex-col">
              <span className="font-semibold">{label}</span>
              <span className="text-sm text-muted-foreground">{hint}</span>
            </span>
          </label>
        ))}
        <p className="text-sm text-muted-foreground">Emergencies always alert you straight away, in both modes.</p>
      </Card>

      <Card className="flex flex-col gap-3 p-5">
        <SectionLabel>Due times by urgency (hours)</SectionLabel>
        <p className="text-sm text-muted-foreground">Defaults follow UK median repair targets: 24 h for emergencies, 28 days (672 h) for non-emergencies.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {URGENCIES.map((u) => (
            <label key={u} className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">{URGENCY_LABEL[u]}</span>
              <Input type="number" name={`due_${u}`} min={1} max={2160} defaultValue={dueHours[u]} required />
            </label>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-3 p-5">
        <SectionLabel>Portfolio problem bar</SectionLabel>
        <div className="grid gap-2 sm:grid-cols-2">
          {STATS.map(([key, label]) => (
            <label key={key} className="flex min-h-11 items-center gap-3 rounded-lg border border-border px-3">
              <input type="checkbox" name={`stat_${key}`} defaultChecked={stats.includes(key)} className="size-4 accent-[var(--primary)]" />
              {label}
            </label>
          ))}
        </div>
      </Card>

      <ErrorNote>{state?.error}</ErrorNote>
      {state?.ok && <p role="status" className="text-sm text-primary">{state.ok}</p>}
      <SubmitButton pendingText="Saving…" className="self-start">
        Save settings
      </SubmitButton>
    </form>
  );
}
