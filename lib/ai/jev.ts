import "server-only";
import { choice, image, TypeSafeClient, type Asset } from "@typesafe-ai/sdk";
import type { NextStep, Trade, IssueType, Scope, Urgency } from "@/lib/domain";
import { logAiCall } from "./log";
import type { ChoiceFields, ClassifierInput } from "./types";

// Jev answers the classifier's fixed-choice fields with a confidence each (architecture §5.4).

export const JEV_CONFIDENCE_THRESHOLD = 0.8;

export function jevConfigured() {
  return Boolean(process.env.TYPESAFE_API_KEY);
}

let client: TypeSafeClient | null = null;
function getClient() {
  client ??= new TypeSafeClient();
  return client;
}

export type JevResult = { fields: ChoiceFields; minConfidence: number; confidences: Record<string, number> };

export async function classifyWithJev(input: ClassifierInput, inputRef: string): Promise<JevResult> {
  // related_tickets: Jev picks from a list of the building's open tickets built by code.
  const relatedLabels: Record<string, string | null> = { none: "None of these tickets is the same problem" };
  const relatedIds: Record<string, string> = {};
  input.openTickets.slice(0, 20).forEach((t, i) => {
    relatedLabels[`t${i + 1}`] = t.label;
    relatedIds[`t${i + 1}`] = t.id;
  });

  const useImages = input.images.length > 0 && process.env.JEV_IMAGES !== "false";
  const photos: Asset[] = useImages ? input.images.slice(0, 4).map((img) => image(img.bytes)) : [];

  const state: Record<string, unknown> = {
    report: input.text || "(no text, see photos)",
    source: input.source === "sensor" ? "building sensor, confirmed by the tenant" : "tenant report",
    flat: `Flat ${input.flat.number}, floor ${input.flat.floor}`,
  };
  if (input.sensor) state.sensor = input.sensor;
  if (photos.length) state.photos = photos;

  const started = Date.now();
  try {
    const response = await getClient().systemOne(
      {
        state: state as never,
        questions: {
          issue_type: choice("What kind of problem in a rented flat is this?", {
            water: "Leaks, dripping pipes, no hot water, blocked drains",
            heating: "Cold rooms, radiators, faulty valves, boiler",
            mould: "Mould, damp walls, high humidity",
            electricity: "Sockets, lights, fuses, wiring, gas appliances",
            defect: "Doors, hinges, windows not sealing, locks, paint, small damage",
            other: "Anything else",
          } satisfies Record<IssueType, string>),
          scope: choice("Does this affect only this flat, or the whole building?", {
            apartment: "Only this flat",
            building: "The whole building or shared systems (boiler, main pipes, all flats)",
          } satisfies Record<Scope, string>),
          urgency: choice(
            "How urgent is the repair? Scraped paint is low; leaking water or no heating in winter is high.",
            {
              emergency: "Danger to people or major damage right now: gas, smoke, sparks, flooding",
              high: "Must be fixed within a day: active leak, no heating, no hot water, no power",
              medium: "Should be fixed within weeks: damp, mould, a slow drip, a broken appliance",
              low: "Cosmetic or minor: scraped paint, a loose hinge",
            } satisfies Record<Urgency, string>,
          ),
          next_step: choice("What should happen next?", {
            quick_fix: "The tenant can safely fix it with a short guide (bleed a radiator, reset a tripped switch)",
            schedule_technician: "A technician needs to visit",
            inform_landlord: "Log it for the landlord's next planned visit, no booking (cosmetic damage)",
            dismiss: "Not a maintenance problem, or no problem at all",
          } satisfies Record<NextStep, string>),
          trade: choice("Which trade should fix it?", {
            plumber: "Plumber",
            heating: "Heating engineer",
            electrician: "Electrician",
            handyman: "Handyman",
            none: "No technician needed",
          } satisfies Record<Trade, string>),
          related: choice("Is this the same problem as one of the building's open tickets?", relatedLabels),
        },
      },
      useImages ? { headers: { "TypeSafe-Danger-Zone-Images": "true" } } : undefined,
    );

    const a = response.answers;
    const confidences = {
      issue_type: a.issue_type.confidence,
      scope: a.scope.confidence,
      urgency: a.urgency.confidence,
      next_step: a.next_step.confidence,
      trade: a.trade.confidence,
      related: a.related.confidence,
    };
    const minConfidence = Math.min(...Object.values(confidences));
    const fields: ChoiceFields = {
      issue_type: a.issue_type.choice,
      scope: a.scope.choice,
      urgency: a.urgency.choice,
      next_step: a.next_step.choice,
      trade: a.trade.choice,
      related_ticket_id: a.related.choice === "none" ? null : (relatedIds[a.related.choice] ?? null),
    };

    await logAiCall({
      provider: "jev",
      model: response.model,
      purpose: "classify",
      input_ref: inputRef,
      output: { fields, confidences, usage: response.usage },
      confidence: minConfidence,
      latency_ms: Date.now() - started,
    });
    return { fields, minConfidence, confidences };
  } catch (err) {
    await logAiCall({
      provider: "jev",
      purpose: "classify",
      input_ref: inputRef,
      latency_ms: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
