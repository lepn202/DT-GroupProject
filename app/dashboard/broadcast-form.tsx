"use client";

import { useActionState, useRef } from "react";
import { Megaphone } from "lucide-react";
import { ErrorNote, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { sendBroadcast } from "@/lib/actions/landlord";

/** Master message bar: broadcast to every tenant of a building (pinned on their Home). */
export function BroadcastForm({ buildings, fixedBuildingId }: { buildings?: { id: string; name: string }[]; fixedBuildingId?: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(async (prev: Awaited<ReturnType<typeof sendBroadcast>>, form: FormData) => {
    const result = await sendBroadcast(prev, form);
    if (result?.ok) formRef.current?.reset();
    return result;
  }, undefined);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        {fixedBuildingId ? (
          <input type="hidden" name="building_id" value={fixedBuildingId} />
        ) : (
          <Select name="building_id" aria-label="Building" className="sm:w-56" defaultValue="" required>
            <option value="" disabled>
              Choose building
            </option>
            {buildings?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        )}
        <div className="relative flex-1">
          <Megaphone className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} aria-hidden />
          <Input name="text" placeholder="e.g. Heating technician coming Thursday." aria-label="Message to all tenants" className="pl-10" required />
        </div>
        <SubmitButton pendingText="Sending…">Send broadcast</SubmitButton>
      </div>
      <ErrorNote>{state?.error}</ErrorNote>
      {state?.ok && <p role="status" className="text-sm text-primary">{state.ok}</p>}
    </form>
  );
}
