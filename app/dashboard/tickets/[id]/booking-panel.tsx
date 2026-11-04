"use client";

import { useActionState } from "react";
import { ErrorNote } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { bookTechnician } from "@/lib/actions/landlord";
import { cn } from "@/lib/utils";

export type SlotOption = { value: string; technician: string; trade: string; when: string; custom: boolean };

/**
 * Book now (emergencies) or pick another slot (manual mode, no overlap, building-wide).
 * The first option is the suggestion: the earliest free technician with the right trade,
 * the landlord's own technicians before the shared pool (architecture §5.7).
 */
export function BookingPanel({ ticketId, options, title, emergency }: { ticketId: string; options: SlotOption[]; title: string; emergency?: boolean }) {
  const [state, action] = useActionState(bookTechnician.bind(null, ticketId), undefined);
  if (state?.ok) {
    return (
      <p role="status" className="rounded-lg bg-primary-soft px-3 py-2 text-sm font-semibold text-primary-hover">
        {state.ok}
      </p>
    );
  }
  if (!options.length) {
    return <p className="text-sm text-muted-foreground">No technician with this trade has a free slot in the next two weeks. Add one on the Technicians page.</p>;
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">{title}</legend>
        {options.map((o, i) => (
          <label
            key={o.value}
            className={cn(
              "flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft",
            )}
          >
            <input type="radio" name="slot" value={o.value} defaultChecked={i === 0} className="mt-0.5 accent-[var(--primary)]" />
            <span className="flex flex-col">
              <span className="font-semibold">
                {o.when}
                {i === 0 && <span className="ml-2 rounded-full bg-card px-2 py-0.5 text-xs font-semibold text-muted-foreground">Suggested</span>}
              </span>
              <span className="text-muted-foreground">
                {o.technician} · {o.trade} · {o.custom ? "your technician" : "shared pool"}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <ErrorNote>{state?.error}</ErrorNote>
      <SubmitButton variant={emergency ? "destructive" : "primary"} pendingText="Booking…">
        {emergency ? "Book now" : "Book this slot"}
      </SubmitButton>
    </form>
  );
}
