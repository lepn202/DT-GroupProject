import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Logs every AI call in ai_calls (architecture §5.4), so cost and latency can be checked. */
export async function logAiCall(row: {
  provider: "jev" | "claude" | "rules";
  model?: string | null;
  purpose: string;
  input_ref?: string | null;
  output?: unknown;
  confidence?: number | null;
  cost?: number | null;
  latency_ms?: number | null;
  error?: string | null;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("ai_calls").insert(row);
  if (error) console.error("ai_calls insert failed", error.message);
}
