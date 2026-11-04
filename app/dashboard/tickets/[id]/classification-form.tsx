"use client";

import { useActionState } from "react";
import { ErrorNote, Field, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { updateClassification } from "@/lib/actions/landlord";
import {
  ISSUE_LABEL,
  ISSUE_TYPES,
  NEXT_STEP_LABEL,
  NEXT_STEPS,
  SCOPES,
  TRADE_LABEL,
  TRADES,
  URGENCIES,
  URGENCY_LABEL,
  type Ticket,
} from "@/lib/domain";

export function ClassificationForm({ ticket }: { ticket: Ticket }) {
  const [state, action] = useActionState(updateClassification.bind(null, ticket.id), undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Issue">
          <Select name="issue_type" defaultValue={ticket.issue_type ?? "other"}>
            {ISSUE_TYPES.map((v) => (
              <option key={v} value={v}>
                {ISSUE_LABEL[v]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Urgency">
          <Select name="urgency" defaultValue={ticket.urgency ?? "medium"}>
            {URGENCIES.map((v) => (
              <option key={v} value={v}>
                {URGENCY_LABEL[v]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Next step">
          <Select name="next_step" defaultValue={ticket.next_step ?? "schedule_technician"}>
            {NEXT_STEPS.map((v) => (
              <option key={v} value={v}>
                {NEXT_STEP_LABEL[v]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Trade">
          <Select name="trade" defaultValue={ticket.trade ?? "none"}>
            {TRADES.map((v) => (
              <option key={v} value={v}>
                {TRADE_LABEL[v]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Scope">
          <Select name="scope" defaultValue={ticket.scope}>
            {SCOPES.map((v) => (
              <option key={v} value={v}>
                {v === "building" ? "Whole building" : "This flat"}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Summary">
        <Textarea name="summary" defaultValue={ticket.summary ?? ""} rows={2} required />
      </Field>
      <ErrorNote>{state?.error}</ErrorNote>
      {state?.ok && <p role="status" className="text-sm text-primary">{state.ok}</p>}
      <SubmitButton variant="secondary" pendingText="Saving…" className="self-start">
        Save classification
      </SubmitButton>
    </form>
  );
}
