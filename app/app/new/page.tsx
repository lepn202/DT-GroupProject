import { requireTenant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { presetOf } from "@/lib/sensors";
import { AddTicket } from "./add-ticket";

export default async function NewTicketPage({ searchParams }: { searchParams: Promise<{ sensor?: string }> }) {
  const tenant = await requireTenant();
  const { sensor } = await searchParams;
  // "Add photo" on a sensor prompt: the photo confirms that event (architecture §5.2).
  let sensorPrompt: { id: string; question: string } | null = null;
  if (sensor && /^[0-9a-f-]{36}$/.test(sensor)) {
    const supabase = await createClient();
    const { data } = await supabase.from("sensor_events").select("id, metric, preset").eq("id", sensor).eq("unit_id", tenant.unit.id).maybeSingle();
    if (data) sensorPrompt = { id: data.id, question: presetOf(data).question };
  }
  return <AddTicket userId={tenant.user_id} flat={tenant.unit.number} building={tenant.building.name} sensorPrompt={sensorPrompt} />;
}
