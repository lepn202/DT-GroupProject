import type { IssueType, NextStep, Scope, Trade, Urgency } from "@/lib/domain";

/** Everything the classifier knows about one report. Built by code, never includes names or contact details. */
export type ClassifierInput = {
  /** Tenant's note and voice transcript, or a sensor event description. */
  text: string;
  source: "tenant" | "sensor";
  sensor?: { metric: string; value: string; duration: string | null; details: string | null };
  /** JPEG/PNG image bytes: photos and video frames. */
  images: { bytes: Uint8Array; mediaType: "image/jpeg" | "image/png" }[];
  flat: { number: string; floor: number };
  /** The building's open tickets, for related_tickets. */
  openTickets: { id: string; label: string }[];
};

/** The classifier output (product.md §11). */
export type Classification = {
  issue_type: IssueType;
  scope: Scope;
  urgency: Urgency;
  next_step: NextStep;
  trade: Trade;
  room: string | null;
  quick_fix_text: string | null;
  summary: string;
  related_ticket_id: string | null;
  safety_advice: string | null;
  classified_by: "jev" | "claude" | "rules";
  /** Lowest confidence across the fixed-choice fields, when known. */
  confidence: number | null;
  needs_triage: boolean;
};

/** The fixed-choice fields Jev answers. */
export type ChoiceFields = Pick<Classification, "issue_type" | "scope" | "urgency" | "next_step" | "trade" | "related_ticket_id">;

/** The free-text fields Claude writes. */
export type TextFields = Pick<Classification, "summary" | "room" | "quick_fix_text">;
