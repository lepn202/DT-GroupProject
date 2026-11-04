import type { ClassifierInput } from "./types";

// Safety floor (architecture §5.4): these force urgency = emergency, whatever the AI says.
const EMERGENCY_WORDS = /\b(gas|smoke|smoking|sparks?|sparking|burning|fire|flames?)\b/i;
const EVACUATE_WORDS = /\b(gas|smoke|smoking|fire|flames?)\b/i;

export const EVACUATE_ADVICE =
  "If you smell gas or see smoke: leave the flat now, don't use light switches or open flames, and call 112 from outside.";

export type SafetyResult = { emergency: boolean; advice: string | null };

export function checkSafety(input: Pick<ClassifierInput, "text" | "sensor">): SafetyResult {
  const leakSensor = input.sensor?.metric === "leak";
  const emergency = leakSensor || EMERGENCY_WORDS.test(input.text);
  const advice = EVACUATE_WORDS.test(input.text) ? EVACUATE_ADVICE : null;
  return { emergency, advice };
}
