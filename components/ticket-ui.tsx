import { ChevronUp, ChevronsUp, CloudDrizzle, Droplet, Flame, HelpCircle, Minus, TriangleAlert, Wrench, Zap } from "lucide-react";
import {
  dueState,
  formatDate,
  STAGE_LABEL,
  STAGE_LONG_LABEL,
  stageOf,
  URGENCY_LABEL,
  type IssueType,
  type Stage,
  type Ticket,
  type TicketStatus,
  type Urgency,
} from "@/lib/domain";
import { cn } from "@/lib/utils";

const ICON_PROPS = { strokeWidth: 1.75, "aria-hidden": true } as const;

export function IssueIcon({ type, className }: { type: IssueType | null; className?: string }) {
  const cls = cn("size-5 shrink-0", className);
  switch (type) {
    case "water":
      return <Droplet className={cls} {...ICON_PROPS} />;
    case "heating":
      return <Flame className={cls} {...ICON_PROPS} />;
    case "mould":
      return <CloudDrizzle className={cls} {...ICON_PROPS} />;
    case "electricity":
      return <Zap className={cls} {...ICON_PROPS} />;
    case "defect":
      return <Wrench className={cls} {...ICON_PROPS} />;
    default:
      return <HelpCircle className={cls} {...ICON_PROPS} />;
  }
}

const URGENCY_STYLE: Record<Urgency, string> = {
  emergency: "bg-emergency-tint text-emergency-text",
  high: "bg-high-tint text-high-text",
  medium: "bg-medium-tint text-medium-text",
  low: "bg-low-tint text-low-text",
};

/** Urgency is never colour alone: label + icon shape + hue (design principle 05). */
export function UrgencyBadge({ urgency, className }: { urgency: Urgency | null; className?: string }) {
  if (!urgency) {
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground", className)}>
        Classifying…
      </span>
    );
  }
  const icon =
    urgency === "emergency" ? (
      <TriangleAlert className="size-3.5 fill-emergency text-emergency-tint" strokeWidth={2} aria-hidden />
    ) : urgency === "high" ? (
      <ChevronsUp className="size-3.5 text-high" strokeWidth={2.5} aria-hidden />
    ) : urgency === "medium" ? (
      <ChevronUp className="size-3.5 text-medium-text" strokeWidth={2.5} aria-hidden />
    ) : (
      <Minus className="size-3.5 text-low-text" strokeWidth={2.5} aria-hidden />
    );
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap", URGENCY_STYLE[urgency], className)}>
      {icon}
      {URGENCY_LABEL[urgency]}
    </span>
  );
}

const STAGE_DOT: Record<Stage, string> = {
  1: "border-[1.5px] border-stage-logged bg-transparent",
  2: "bg-stage-booked",
  3: "bg-stage-progress",
  4: "bg-primary",
};

export function StageChip({ status }: { status: TicketStatus }) {
  const stage = stageOf(status);
  if (!stage) {
    return <span className="text-sm text-muted-foreground">Dismissed</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap">
      <span className={cn("inline-block size-2.5 rounded-full", STAGE_DOT[stage])} aria-hidden />
      {STAGE_LABEL[stage]}
    </span>
  );
}

export function DueTag({ ticket }: { ticket: Pick<Ticket, "due_at" | "status"> }) {
  const due = dueState(ticket);
  if (due.kind === "overdue") {
    return (
      <span className="inline-flex rounded-md bg-emergency px-2 py-0.5 text-xs font-semibold tracking-wide whitespace-nowrap text-white uppercase">
        Overdue {due.hours} h
      </span>
    );
  }
  if (due.kind === "soon") {
    return (
      <span className="inline-flex rounded-md border border-high px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-high-text">
        Due in {due.hours} h
      </span>
    );
  }
  if (due.kind === "date") {
    return <span className="font-mono text-[13px] whitespace-nowrap text-muted-foreground">Due {formatDate(due.at)}</span>;
  }
  return <span className="text-sm text-muted-foreground">—</span>;
}

/** Four-stage tracker with labels visible (design principle 02). */
export function ProgressTracker({ status, compact = false }: { status: TicketStatus; compact?: boolean }) {
  const stage = stageOf(status) ?? 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-4 gap-1" role="img" aria-label={stage ? `Stage ${stage} of 4: ${STAGE_LONG_LABEL[stage as Stage]}` : "Dismissed"}>
        {[1, 2, 3, 4].map((s) => (
          <span
            key={s}
            className={cn(
              "h-1.5 rounded-full",
              s <= stage ? (stage === 4 ? "bg-primary" : stage === 3 ? "bg-stage-progress" : stage === 2 ? "bg-stage-booked" : "bg-stage-logged") : "bg-muted",
            )}
          />
        ))}
      </div>
      {!compact && (
        <div className="grid grid-cols-4 gap-1 text-[11px] leading-tight text-muted-foreground">
          {([1, 2, 3, 4] as Stage[]).map((s) => (
            <span key={s} className={cn(s === stage && "font-semibold text-foreground")}>
              {STAGE_LONG_LABEL[s]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
