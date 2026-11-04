import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Short-lived signed URLs for media in the private bucket. Check access before calling. */
export async function signMedia(paths: string[], expiresIn = 600): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const admin = createAdminClient();
  const { data } = await admin.storage.from("media").createSignedUrls(paths, expiresIn);
  const out: Record<string, string> = {};
  for (const row of data ?? []) if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
  return out;
}
