import { NextResponse, type NextRequest } from "next/server";
import { sendDueReminders } from "@/lib/reminders";
import { createAdminClient } from "@/lib/supabase/admin";

// Called every 15 minutes by Supabase Cron (pg_cron + pg_net), protected with a shared secret.
// See README, "Appointment reminders".
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await sendDueReminders(createAdminClient());
  return NextResponse.json(result);
}

export const GET = POST;
