import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { ISSUE_TYPES, NEXT_STEPS, SCOPES, TRADES, URGENCIES } from "@/lib/domain";
import { logAiCall } from "./log";
import type { ChoiceFields, ClassifierInput, TextFields } from "./types";

// Claude writes the free-text fields and steps in when Jev is unsure (architecture §5.4).

const MODEL = "claude-opus-5-5";

export function claudeConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic();
  return client;
}

const SYSTEM = `You help run maintenance for rental flats. Tenants report problems with a photo, video frames, a voice memo transcript or a short text; building sensors report anomalies that the tenant has confirmed.
Write in plain British English. The summary is one sentence shown on the landlord's dashboard: say what is wrong and where, with no names.
A quick-fix guide is only for problems a tenant can safely fix themselves (bleeding a radiator, resetting a tripped switch, re-sealing a window): short numbered steps. Never suggest gas, electrical-wiring or structural DIY.`;

const TextSchema = z.object({
  summary: z.string().describe("One sentence for the landlord's dashboard"),
  room: z.string().nullable().describe("The room, if the report names or shows one, e.g. 'kitchen'"),
  quick_fix_text: z.string().nullable().describe("Step-by-step guide, only when next_step is quick_fix"),
});

const FullSchema = TextSchema.extend({
  issue_type: z.enum(ISSUE_TYPES),
  scope: z.enum(SCOPES),
  urgency: z.enum(URGENCIES),
  next_step: z.enum(NEXT_STEPS),
  trade: z.enum(TRADES),
  related_ticket_id: z.string().nullable().describe("id of the open ticket this is the same problem as, or null"),
  confident: z.boolean().describe("false if the report is too unclear to classify reliably"),
});

function describe(input: ClassifierInput): string {
  const lines = [
    `Source: ${input.source === "sensor" ? "building sensor, confirmed by the tenant" : "tenant report"}`,
    `Flat ${input.flat.number}, floor ${input.flat.floor}`,
  ];
  if (input.sensor) lines.push(`Sensor event: ${JSON.stringify(input.sensor)}`);
  lines.push(`Report: ${input.text || "(no text, see images)"}`);
  return lines.join("\n");
}

function content(input: ClassifierInput, task: string): Anthropic.Beta.BetaContentBlockParam[] {
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = input.images.slice(0, 4).map((img) => ({
    type: "image",
    source: { type: "base64", media_type: img.mediaType, data: Buffer.from(img.bytes).toString("base64") },
  }));
  blocks.push({ type: "text", text: `${describe(input)}\n\n${task}` });
  return blocks;
}

async function parse<T extends z.ZodType>(schema: T, input: ClassifierInput, task: string, purpose: string, inputRef: string) {
  const started = Date.now();
  try {
    const response = await getClient().beta.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      // Thinking can't be turned off on this model; low effort keeps these calls quick.
      output_config: { effort: "low", format: betaZodOutputFormat(schema) },
      // Server-side fallback on a safety decline, routed by refusal category.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{ role: "user", content: content(input, task) }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      throw new Error(`Claude returned no usable output (stop_reason: ${response.stop_reason})`);
    }
    await logAiCall({
      provider: "claude",
      model: response.model,
      purpose,
      input_ref: inputRef,
      output: { parsed: response.parsed_output, usage: response.usage },
      latency_ms: Date.now() - started,
    });
    return response.parsed_output as z.infer<T>;
  } catch (err) {
    await logAiCall({
      provider: "claude",
      model: MODEL,
      purpose,
      input_ref: inputRef,
      latency_ms: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/** Summary, room and quick-fix text, once the fixed-choice fields are settled. */
export async function writeTextWithClaude(input: ClassifierInput, fields: ChoiceFields, inputRef: string): Promise<TextFields> {
  const task = `The report has been classified as: ${JSON.stringify(fields)}.
Write the summary and the room${fields.next_step === "quick_fix" ? ", and a quick-fix guide" : " (quick_fix_text must be null)"}.`;
  return parse(TextSchema, input, task, "write_text", inputRef);
}

/** Full classification, used when Jev is unsure or unavailable. */
export async function classifyWithClaude(input: ClassifierInput, inputRef: string) {
  const open = input.openTickets.length
    ? input.openTickets.map((t) => `- ${t.id}: ${t.label}`).join("\n")
    : "(none)";
  const task = `Classify this report.
Urgency: emergency = danger right now (gas, smoke, sparks, flooding); high = fix within a day (active leak, no heating, no hot water, no power); medium = within weeks (damp, mould, slow drip); low = cosmetic.
next_step: quick_fix only if the tenant can safely fix it; schedule_technician if someone must visit; inform_landlord for cosmetic issues kept for the next planned visit; dismiss if it isn't a maintenance problem.
trade must be none unless next_step is schedule_technician.
The building's open tickets (set related_ticket_id if this is the same problem):
${open}`;
  return parse(FullSchema, input, task, "classify_fallback", inputRef);
}
