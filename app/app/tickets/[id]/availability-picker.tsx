"use client";

import { useMemo, useState, useTransition } from "react";
import { Button, ErrorNote } from "@/components/ui";
import { saveAvailability } from "@/lib/actions/tenant";
import { cn } from "@/lib/utils";

type Window = { starts_at: string; ends_at: string };

const TZ = "Europe/Berlin";
const dayLabel = (iso: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: TZ }).format(new Date(iso));
const hourLabel = (iso: string) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: TZ }).format(new Date(iso));

/**
 * "When are you home?" 2-hour windows over the next 7 days (architecture §5.7).
 * Windows before the ticket's due time are highlighted (dashed orange, as in the design system).
 */
export function AvailabilityPicker({ ticketId, windows, dueAt, retry }: { ticketId: string; windows: Window[]; dueAt: string | null; retry: boolean }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const days = useMemo(() => {
    const map = new Map<string, Window[]>();
    for (const w of windows) {
      const key = dayLabel(w.starts_at);
      map.set(key, [...(map.get(key) ?? []), w]);
    }
    return [...map.entries()];
  }, [windows]);

  const toggle = (w: Window) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(w.starts_at)) next.delete(w.starts_at);
      else next.add(w.starts_at);
      return next;
    });

  const submit = () =>
    start(async () => {
      setError(null);
      const chosen = windows.filter((w) => picked.has(w.starts_at));
      const result = await saveAvailability(ticketId, chosen);
      if ("error" in result) setError(result.error);
      else setPicked(new Set());
    });

  const due = dueAt ? new Date(dueAt) : null;

  return (
    <section className="flex flex-col gap-3 rounded-xl border-2 border-primary bg-card p-4" aria-labelledby="availability-title">
      <div className="flex flex-col gap-1">
        <h2 id="availability-title" className="text-lg leading-6 font-semibold">
          {retry ? "Add a few more times" : "When are you home?"}
        </h2>
        <p className="text-sm text-muted-foreground">
          Pick every 2-hour slot that works. We book the earliest one a technician is free.
          {due && " Dashed slots are before the target repair time."}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {days.map(([day, ws]) => (
          <fieldset key={day} className="flex flex-col gap-1.5">
            <legend className="mb-1 text-sm font-semibold">{day}</legend>
            <div className="grid grid-cols-3 gap-2">
              {ws.map((w) => {
                const on = picked.has(w.starts_at);
                const early = due && new Date(w.ends_at) <= due;
                return (
                  <button
                    key={w.starts_at}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(w)}
                    className={cn(
                      "min-h-11 rounded-lg border text-sm font-medium transition-colors",
                      on ? "border-2 border-primary bg-primary-soft font-semibold text-primary-hover" : early ? "border-dashed border-high bg-card" : "border-border bg-card hover:bg-muted",
                    )}
                  >
                    {hourLabel(w.starts_at)}–{hourLabel(w.ends_at)}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
      <ErrorNote>{error}</ErrorNote>
      <Button onClick={submit} disabled={pending || picked.size === 0} className="sticky bottom-20">
        {pending ? "Finding a technician…" : picked.size ? `Send ${picked.size} time${picked.size > 1 ? "s" : ""}` : "Pick at least one time"}
      </Button>
    </section>
  );
}
