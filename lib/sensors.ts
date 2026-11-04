import "server-only";
import { notifyTenantsOfUnits } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { addEvent, addMessage } from "@/lib/tickets";

// Simulated sensors (architecture §5.1). Each click on the demo panel inserts one
// sensor_event that is already an anomaly; there is no stream of readings.

type Admin = ReturnType<typeof createAdminClient>;

export type PresetKey = "cold_room" | "boiler" | "leak" | "no_hot_water" | "mould_risk";

type Preset = {
  label: string;
  metric: "temperature" | "leak" | "hot_water" | "humidity";
  value: string;
  durationHours: number;
  duration: string | null;
  details: string;
  /** The tenant prompt: a yes/no question, "Yes" confirms the problem. */
  question: string;
  explain: string;
  /** Emergencies don't wait for the tenant (§5.2, point 4). */
  emergency?: boolean;
};

export const PRESETS: Record<Exclude<PresetKey, "boiler">, Preset> = {
  cold_room: {
    label: "Cold room",
    metric: "temperature",
    value: "15 °C",
    durationHours: 6,
    duration: "6 h",
    details: "Living room 15 °C for 6 h with the radiator valve open",
    question: "Is your living room cold?",
    explain: "It has been 15 °C for 6 hours with the radiator on.",
  },
  leak: {
    label: "Leak",
    metric: "leak",
    value: "wet",
    durationHours: 0,
    duration: null,
    details: "Leak detector under the kitchen sink is wet",
    question: "Is there water on the floor?",
    explain: "The leak sensor under your kitchen sink detected water. Your landlord has already been alerted.",
    emergency: true,
  },
  no_hot_water: {
    label: "No hot water",
    metric: "hot_water",
    value: "27 °C",
    durationHours: 2,
    duration: "2 h",
    details: "Hot-water pipe below 30 °C for 2 h",
    question: "Is your hot water cold?",
    explain: "The hot-water pipe has been below 30 °C for 2 hours.",
  },
  mould_risk: {
    label: "Mould risk",
    metric: "humidity",
    value: "74 %",
    durationHours: 72,
    duration: "3 days",
    details: "Bedroom humidity above 70 % for 3 days",
    question: "Do you see damp patches or mould?",
    explain: "Humidity in your bedroom has been above 70 % for 3 days.",
  },
};

export const PRESET_OPTIONS: { key: PresetKey; label: string; hint: string }[] = [
  { key: "cold_room", label: "Cold room", hint: "15 °C for 6 h, radiator on" },
  { key: "boiler", label: "Boiler failure", hint: "Cold room in every flat on the floor" },
  { key: "leak", label: "Leak", hint: "Emergency: ticket at once, landlord alerted" },
  { key: "no_hot_water", label: "No hot water", hint: "Pipe below 30 °C for 2 h" },
  { key: "mould_risk", label: "Mould risk", hint: "Humidity > 70 % for 3 days" },
];

export function presetOf(event: { preset: string | null; metric: string }): Preset {
  const key = (event.preset === "boiler" ? "cold_room" : event.preset) as keyof typeof PRESETS | null;
  if (key && PRESETS[key]) return PRESETS[key];
  return Object.values(PRESETS).find((p) => p.metric === event.metric) ?? PRESETS.cold_room;
}

/** Text the classifier reads for a sensor report. No names or contact details. */
export function sensorReportText(event: { metric: string; value: string; duration: string | null; details: string | null }, confirmed: "yes" | "pending") {
  const parts = [`Sensor: ${event.details ?? `${event.metric} ${event.value}`}.`];
  parts.push(confirmed === "yes" ? "Tenant confirmed: yes." : "Not yet confirmed by the tenant.");
  return parts.join(" ");
}

type SensorEvent = {
  id: string;
  unit_id: string;
  metric: string;
  value: string;
  duration: string | null;
  details: string | null;
  preset: string | null;
  occurred_at: string;
  confirmation: "pending" | "yes" | "no";
  ticket_id: string | null;
};

/** Inserts one sensor event and prompts the flat's tenants. Returns ticket ids that need classifying. */
export async function fireSensorEvent(admin: Admin, unitId: string, key: Exclude<PresetKey, "boiler">, presetLabel: PresetKey = key) {
  const p = PRESETS[key];
  const occurredAt = new Date(Date.now() - p.durationHours * 36e5).toISOString();
  const { data: event, error } = await admin
    .from("sensor_events")
    .insert({ unit_id: unitId, metric: p.metric, value: p.value, duration: p.duration, details: p.details, preset: presetLabel, occurred_at: occurredAt })
    .select("*")
    .single<SensorEvent>();
  if (error || !event) throw new Error(error?.message ?? "Could not insert the sensor event");

  // The "push": an in-app prompt (Home shows the Yes / No / Add photo card).
  await notifyTenantsOfUnits(admin, [unitId], { kind: "sensor_prompt", title: p.question, body: p.explain, link: "/app" });

  // Emergencies create the ticket straight away; the tenant prompt stays pinned.
  let ticketId: string | null = null;
  if (p.emergency) ticketId = await createSensorTicket(admin, event, null);
  return { event, ticketId };
}

/** Ticket + report (source = sensor) for an event. Classification runs afterwards (processTicket). */
export async function createSensorTicket(admin: Admin, event: SensorEvent, tenantId: string | null) {
  const { data: unit } = await admin.from("units").select("building_id").eq("id", event.unit_id).single();
  if (!unit) throw new Error("Unit not found");
  const { data: ticket, error } = await admin
    .from("tickets")
    .insert({ building_id: unit.building_id, unit_id: event.unit_id, status: "logged", occurred_at: event.occurred_at })
    .select("id")
    .single();
  if (error || !ticket) throw new Error(error?.message ?? "Could not create the ticket");
  await admin.from("reports").insert({
    unit_id: event.unit_id,
    tenant_id: tenantId,
    source: "sensor",
    sensor_event_id: event.id,
    text: sensorReportText(event, tenantId ? "yes" : "pending"),
    ticket_id: ticket.id,
  });
  await admin.from("sensor_events").update({ ticket_id: ticket.id }).eq("id", event.id);
  await addEvent(admin, ticket.id, "created", "system", { sensor: event.metric, confirmed: Boolean(tenantId) });
  return ticket.id as string;
}

/**
 * The tenant's answer to a sensor prompt (architecture §5.2).
 * Yes → a sensor report goes to the classifier. No → dismissed, nothing reaches the landlord;
 * for an emergency the ticket already exists, so "No" is only noted on it.
 * Returns the ticket that needs classifying, if any.
 */
export async function answerSensorEvent(admin: Admin, eventId: string, tenant: { id: string; name: string }, answer: "yes" | "no") {
  const { data: event } = await admin.from("sensor_events").select("*").eq("id", eventId).single<SensorEvent>();
  if (!event || event.confirmation !== "pending") return { classify: null as string | null, ticketId: event?.ticket_id ?? null };
  await admin.from("sensor_events").update({ confirmation: answer, confirmed_at: new Date().toISOString() }).eq("id", eventId);

  if (event.ticket_id) {
    await addEvent(admin, event.ticket_id, answer === "yes" ? "tenant_confirmed" : "tenant_said_no", "tenant", { sensor: event.metric });
    await addMessage(
      admin,
      event.ticket_id,
      "tenant",
      answer === "yes" ? `Yes, I can see it. (Answer to: "${presetOf(event).question}")` : `No, I don't see this. (Answer to: "${presetOf(event).question}")`,
      tenant.name,
    );
    return { classify: null, ticketId: event.ticket_id };
  }
  if (answer === "no") return { classify: null, ticketId: null };
  const ticketId = await createSensorTicket(admin, event, tenant.id);
  return { classify: ticketId, ticketId };
}
