import "server-only";
import { claudeConfigured, classifyWithClaude, writeTextWithClaude } from "./claude";
import { classifyWithJev, jevConfigured, JEV_CONFIDENCE_THRESHOLD } from "./jev";
import { logAiCall } from "./log";
import { classifyByRules, writeTextByRules } from "./rules";
import { checkSafety } from "./safety";
import type { ChoiceFields, Classification, ClassifierInput, TextFields } from "./types";

/**
 * Routing (architecture §5.4):
 *   safety rules → Jev (fixed-choice fields)
 *     all confidences ≥ 0.8 → Claude writes summary, room, quick-fix text
 *     any confidence < 0.8 → Claude classifies everything
 *       still unsure / failed → "needs triage" on the dashboard
 * Missing providers fall back down the chain; with no keys at all, keyword rules keep the demo running.
 */
export async function classify(input: ClassifierInput, inputRef: string): Promise<Classification> {
  const safety = checkSafety(input);

  let fields: ChoiceFields | null = null;
  let text: TextFields | null = null;
  let classifiedBy: Classification["classified_by"] = "rules";
  let confidence: number | null = null;
  let needsTriage = false;

  // 1. Jev for the fixed-choice fields.
  let jevSure = false;
  if (jevConfigured()) {
    try {
      const jev = await classifyWithJev(input, inputRef);
      fields = jev.fields;
      confidence = jev.minConfidence;
      classifiedBy = "jev";
      jevSure = jev.minConfidence >= JEV_CONFIDENCE_THRESHOLD;
    } catch (err) {
      console.error("Jev classification failed", err);
    }
  }

  // 2. Claude: free text when Jev is sure, the whole classification when it isn't.
  if (claudeConfigured()) {
    try {
      if (fields && jevSure) {
        text = await writeTextWithClaude(input, fields, inputRef);
      } else {
        const full = await classifyWithClaude(input, inputRef);
        fields = {
          issue_type: full.issue_type,
          scope: full.scope,
          urgency: full.urgency,
          next_step: full.next_step,
          trade: full.trade,
          related_ticket_id: input.openTickets.some((t) => t.id === full.related_ticket_id) ? full.related_ticket_id : null,
        };
        text = { summary: full.summary, room: full.room, quick_fix_text: full.quick_fix_text };
        classifiedBy = "claude";
        needsTriage = !full.confident;
      }
    } catch (err) {
      console.error("Claude call failed", err);
      // A failed or refused call sends the ticket to "needs triage".
      needsTriage = true;
    }
  } else if (fields && !jevSure) {
    // Jev unsure and no Claude to fall back on.
    needsTriage = true;
  }

  // 3. Nothing worked (or nothing is configured): keyword rules.
  if (!fields) {
    fields = classifyByRules(input);
    classifiedBy = "rules";
    if (jevConfigured() || claudeConfigured()) needsTriage = true;
    await logAiCall({ provider: "rules", purpose: "classify", input_ref: inputRef, output: fields });
  }
  text ??= writeTextByRules(input, fields);

  // Safety floor: never below emergency when the rules fire.
  const urgency = safety.emergency ? "emergency" : fields.urgency;
  let nextStep = fields.next_step;
  if (urgency === "emergency" && (nextStep === "quick_fix" || nextStep === "dismiss")) nextStep = "schedule_technician";
  let trade = fields.trade;
  if (nextStep === "schedule_technician" && trade === "none") {
    trade = fields.issue_type === "water" ? "plumber" : fields.issue_type === "heating" ? "heating" : fields.issue_type === "electricity" ? "electrician" : "handyman";
  }

  return {
    ...fields,
    urgency,
    next_step: nextStep,
    trade,
    summary: text.summary,
    room: text.room,
    quick_fix_text: nextStep === "quick_fix" ? text.quick_fix_text : null,
    safety_advice: safety.advice,
    classified_by: classifiedBy,
    confidence,
    needs_triage: needsTriage,
  };
}
