// Shared domain types and the rules that turn ticket data into what people see.

export const ISSUE_TYPES = ["water", "heating", "mould", "electricity", "defect", "other"] as const;
export const URGENCIES = ["emergency", "high", "medium", "low"] as const;
export const NEXT_STEPS = ["quick_fix", "schedule_technician", "inform_landlord", "dismiss"] as const;
export const TRADES = ["plumber", "heating", "electrician", "handyman", "none"] as const;
export const SCOPES = ["apartment", "building"] as const;
export const STATUSES = ["logged", "confirmed", "quick_fix", "booked", "in_progress", "resolved", "dismissed"] as const;

export type IssueType = (typeof ISSUE_TYPES)[number];
export type Urgency = (typeof URGENCIES)[number];
export type NextStep = (typeof NEXT_STEPS)[number];
export type Trade = (typeof TRADES)[number];
export type Scope = (typeof SCOPES)[number];
export type TicketStatus = (typeof STATUSES)[number];

export type Ticket = {
  id: string;
  building_id: string;
  unit_id: string | null;
  parent_ticket_id: string | null;
  issue_type: IssueType | null;
  room: string | null;
  scope: Scope;
  urgency: Urgency | null;
  next_step: NextStep | null;
  trade: Trade | null;
  quick_fix_text: string | null;
  summary: string | null;
  safety_advice: string | null;
  classified_by: "jev" | "claude" | "rules" | "landlord" | null;
  classification_confidence: number | null;
  status: TicketStatus;
  needs_triage: boolean;
  /** No overlap between the tenant's times and any technician: more times asked for. */
  needs_windows: boolean;
  landlord_touched: boolean;
  occurred_at: string;
  due_at: string | null;
  resolved_at: string | null;
  archived_at: string | null;
  created_at: string;
};

export const ISSUE_LABEL: Record<IssueType, string> = {
  water: "Water",
  heating: "Heating",
  mould: "Mould",
  electricity: "Electricity",
  defect: "Small defect",
  other: "Other",
};

export const URGENCY_LABEL: Record<Urgency, string> = {
  emergency: "Emergency",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const URGENCY_RANK: Record<Urgency, number> = { emergency: 0, high: 1, medium: 2, low: 3 };

export const NEXT_STEP_LABEL: Record<NextStep, string> = {
  quick_fix: "Quick fix",
  schedule_technician: "Schedule technician",
  inform_landlord: "Inform landlord",
  dismiss: "Dismiss",
};

export const TRADE_LABEL: Record<Trade, string> = {
  plumber: "Plumber",
  heating: "Heating",
  electrician: "Electrician",
  handyman: "Handyman",
  none: "None",
};

/** The four tenant-facing stages (architecture §5.3). 0 = not shown (dismissed). */
export type Stage = 1 | 2 | 3 | 4;
export const STAGE_LABEL: Record<Stage, string> = {
  1: "Logged",
  2: "Booked",
  3: "In progress",
  4: "Resolved",
};
export const STAGE_LONG_LABEL: Record<Stage, string> = {
  1: "Repair logged",
  2: "Appointment booked",
  3: "Fix in progress",
  4: "Resolved",
};

export function stageOf(status: TicketStatus): Stage | null {
  switch (status) {
    case "logged":
    case "confirmed":
    case "quick_fix":
      return 1;
    case "booked":
      return 2;
    case "in_progress":
      return 3;
    case "resolved":
      return 4;
    default:
      return null;
  }
}

/** Dashboard progress: 25 / 50 / 75 / 100 % by stage. */
export function progressOf(status: TicketStatus): number {
  const stage = stageOf(status);
  return stage ? stage * 25 : 0;
}

export function isOpen(t: Pick<Ticket, "status">) {
  return t.status !== "resolved" && t.status !== "dismissed";
}

export type DueState =
  | { kind: "overdue"; hours: number }
  | { kind: "soon"; hours: number }
  | { kind: "date"; at: Date }
  | { kind: "none" };

const SOON_HOURS = 24;

export function dueState(t: Pick<Ticket, "due_at" | "status">, now = new Date()): DueState {
  if (!t.due_at || !isOpen(t)) return { kind: "none" };
  const due = new Date(t.due_at);
  const hours = (due.getTime() - now.getTime()) / 36e5;
  if (hours < 0) return { kind: "overdue", hours: Math.ceil(-hours) };
  if (hours <= SOON_HOURS) return { kind: "soon", hours: Math.max(1, Math.round(hours)) };
  return { kind: "date", at: due };
}

/** Problem list order: emergencies first, then urgency, then due time; resolved at the bottom. */
export function compareTickets(a: Ticket, b: Ticket) {
  const openA = isOpen(a) ? 0 : 1;
  const openB = isOpen(b) ? 0 : 1;
  if (openA !== openB) return openA - openB;
  const ua = a.urgency ? URGENCY_RANK[a.urgency] : 4;
  const ub = b.urgency ? URGENCY_RANK[b.urgency] : 4;
  if (ua !== ub) return ua - ub;
  const da = a.due_at ? new Date(a.due_at).getTime() : Infinity;
  const db = b.due_at ? new Date(b.due_at).getTime() : Infinity;
  return da - db;
}

export type DueHours = Record<Urgency, number>;
export const DEFAULT_DUE_HOURS: DueHours = { emergency: 24, high: 24, medium: 672, low: 672 };

export function computeDueAt(occurredAt: Date, urgency: Urgency, dueHours: Partial<DueHours> | null) {
  const hours = dueHours?.[urgency] ?? DEFAULT_DUE_HOURS[urgency];
  return new Date(occurredAt.getTime() + hours * 36e5);
}

export function ticketTitle(t: Pick<Ticket, "issue_type" | "summary" | "room" | "scope">) {
  if (!t.issue_type) return "New report";
  const base = ISSUE_LABEL[t.issue_type];
  if (t.scope === "building") return `${base} · whole building`;
  return t.room ? `${base} · ${t.room}` : base;
}

// ---------------------------------------------------------------- formatting (Berlin time, en-GB)

const TZ = "Europe/Berlin";

export function formatDate(iso: string | Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", timeZone: TZ }).format(new Date(iso));
}

export function formatDateTime(iso: string | Date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(new Date(iso));
}

export function timeAgo(iso: string | Date, now = new Date()) {
  const s = Math.round((now.getTime() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "yesterday";
  if (d < 14) return `${d} days ago`;
  return formatDate(iso);
}

/** "a plumber", "an electrician". */
export function withArticle(word: string) {
  return `${/^[aeiou]/i.test(word) ? "an" : "a"} ${word}`;
}

/** "Thu 12.11, 08:00–10:00" in Berlin time. */
export function formatSlot(startIso: string | Date, endIso: string | Date) {
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: TZ }).format(new Date(startIso));
  const time = (d: string | Date) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(d));
  return `${day}, ${time(startIso)}–${time(endIso)}`;
}

/** Calendar date and hour of an instant in Berlin time. */
export function berlinParts(at: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", timeZone: TZ })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour) };
}

/** The instant of a Berlin wall-clock time (handles summer/winter time). */
export function berlinTime(year: number, month: number, day: number, hour: number): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour));
  const seen = berlinParts(guess);
  const diffHours = (Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour) - guess.getTime()) / 36e5;
  return new Date(guess.getTime() - diffHours * 36e5);
}

/** 2-hour windows over the next `days` days, 08:00–20:00 Berlin time, starting tomorrow (architecture §5.7). */
export function availabilityWindows(now = new Date(), days = 7) {
  const today = berlinParts(now);
  const out: { starts_at: string; ends_at: string }[] = [];
  for (let d = 1; d <= days; d++) {
    for (const h of [8, 10, 12, 14, 16, 18]) {
      const start = berlinTime(today.year, today.month, today.day + d, h);
      out.push({ starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 2 * 36e5).toISOString() });
    }
  }
  return out;
}

/** Trade a technician needs for an issue type, when the classifier didn't name one. */
export function tradeFor(issue: IssueType | null): Exclude<Trade, "none"> {
  return issue === "water" ? "plumber" : issue === "heating" ? "heating" : issue === "electricity" ? "electrician" : "handyman";
}
