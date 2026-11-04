import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for writes the system owns (ticket status, classification, timeline).
 * Bypasses RLS: only call it after checking who the user is and what they may touch.
 */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
