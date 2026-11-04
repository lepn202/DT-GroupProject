"use client";

import { useActionState } from "react";
import { ErrorNote, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { saveQuickFixGuides } from "@/lib/actions/landlord";

/** Quick-fix guides for one building, in markdown. The chatbot prefers these when they cover a question. */
export function GuidesForm({ buildingId, name, guides }: { buildingId: string; name: string; guides: string }) {
  const [state, action] = useActionState(saveQuickFixGuides, undefined);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="building_id" value={buildingId} />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">{name}</span>
        <Textarea
          name="guides"
          rows={6}
          defaultValue={guides}
          placeholder={"## Radiator\nThe radiator key hangs in the cellar, hook 3. Bleed the valve at the top corner…\n\n## Fuse box\nIn the hallway behind the mirror…"}
          className="font-mono text-sm"
        />
      </label>
      <ErrorNote>{state?.error}</ErrorNote>
      {state?.ok && (
        <p role="status" className="text-sm text-primary">
          {state.ok}
        </p>
      )}
      <SubmitButton variant="secondary" pendingText="Saving…" className="self-start">
        Save guides
      </SubmitButton>
    </form>
  );
}
