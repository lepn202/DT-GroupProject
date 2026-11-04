import type { IssueType, NextStep, Trade, Urgency } from "@/lib/domain";
import type { ChoiceFields, ClassifierInput, TextFields } from "./types";

// Keyword fallback. Used only when no AI provider is configured (or as Claude's stand-in for
// the free-text fields), so the demo still runs locally. Not part of the production routing.

const PATTERNS: { type: IssueType; re: RegExp }[] = [
  { type: "water", re: /\b(leak\w*|drip\w*|water|pipe|flood\w*|hot water|tap|sink|toilet|shower|drain)\b/i },
  { type: "heating", re: /\b(cold|heating|heater|radiator|boiler|warm|temperature|valve)\b/i },
  { type: "mould", re: /\b(mou?ld|damp|humid\w*|condensation|black spots?)\b/i },
  { type: "electricity", re: /\b(electric\w*|socket|outlet|power|light|lamp|fuse|switch|sparks?|gas)\b/i },
  { type: "defect", re: /\b(door|hinge|window|lock|paint|crack|handle|seal\w*|floor|cupboard)\b/i },
];

const SENSOR_TYPE: Record<string, IssueType> = {
  temperature: "heating",
  leak: "water",
  hot_water: "water",
  humidity: "mould",
};

const TRADE_FOR: Record<IssueType, Trade> = {
  water: "plumber",
  heating: "heating",
  mould: "handyman",
  electricity: "electrician",
  defect: "handyman",
  other: "handyman",
};

const MINOR = /\b(paint|scratch\w*|scraped|cosmetic|radiator .*(gurgl\w*|bottom)|bleed|tripped)\b/i;

export function classifyByRules(input: ClassifierInput): ChoiceFields {
  const issue_type: IssueType =
    (input.sensor && SENSOR_TYPE[input.sensor.metric]) ||
    PATTERNS.find((p) => p.re.test(input.text))?.type ||
    "other";

  let urgency: Urgency = "medium";
  if (issue_type === "water" && /\b(leak\w*|flood\w*|on the floor|dripping)\b/i.test(input.text)) urgency = "high";
  if (issue_type === "heating" || (issue_type === "water" && /hot water/i.test(input.text))) urgency = "high";
  if (issue_type === "defect") urgency = "low";

  let next_step: NextStep = "schedule_technician";
  if (/\b(paint|scratch\w*|scraped|cosmetic)\b/i.test(input.text)) {
    urgency = "low";
    next_step = "inform_landlord";
  } else if (MINOR.test(input.text)) {
    next_step = "quick_fix";
  }

  return {
    issue_type,
    scope: /\b(whole building|all flats|everyone|stairwell|entire building)\b/i.test(input.text) ? "building" : "apartment",
    urgency,
    next_step,
    trade: next_step === "schedule_technician" ? TRADE_FOR[issue_type] : "none",
    related_ticket_id: null,
  };
}

const ROOMS = ["kitchen", "bathroom", "bedroom", "living room", "hallway", "toilet", "balcony", "cellar"];

const QUICK_FIXES: Partial<Record<IssueType, string>> = {
  heating:
    "1. Turn the radiator's thermostat to the highest setting.\n2. Place a towel under the bleed valve at the top corner.\n3. Open the valve a quarter turn with a radiator key until water, not air, comes out.\n4. Close the valve. Wait 30 minutes and check if the radiator is warm all over.",
  electricity:
    "1. Find the fuse box (usually in the hallway).\n2. Look for a switch pointing down.\n3. Unplug the appliances on that circuit, then flip the switch back up.\n4. If it trips again straight away, leave it off and tap \"Didn't work\".",
  defect:
    "1. Clean the area with a damp cloth and let it dry.\n2. For small paint scrapes, use a matching touch-up pen or leave it for the next planned visit.\n3. Tap \"Fixed it\" if you're happy, or \"Didn't work\" to ask for a visit.",
};

export function writeTextByRules(input: ClassifierInput, fields: ChoiceFields): TextFields {
  const lower = input.text.toLowerCase();
  const room = ROOMS.find((r) => lower.includes(r)) ?? null;
  const firstSentence = input.text.split(/(?<=[.!?])\s/)[0]?.trim() ?? "";
  const summary = firstSentence
    ? firstSentence.length > 140
      ? `${firstSentence.slice(0, 137)}…`
      : firstSentence
    : `${fields.issue_type} issue reported in flat ${input.flat.number}.`;
  return {
    summary,
    room,
    quick_fix_text: fields.next_step === "quick_fix" ? (QUICK_FIXES[fields.issue_type] ?? QUICK_FIXES.defect!) : null,
  };
}
