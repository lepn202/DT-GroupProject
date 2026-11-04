import Link from "next/link";
import { BellRing, CalendarClock, Droplets, Info, Thermometer, TriangleAlert, Wrench } from "lucide-react";
import { Button, ButtonLink, Card } from "@/components/ui";
import { answerSensorPrompt, markNoticeRead } from "@/lib/actions/tenant";
import { timeAgo } from "@/lib/domain";
import { presetOf } from "@/lib/sensors";
import { cn } from "@/lib/utils";

export type PendingSensorEvent = {
  id: string;
  metric: string;
  value: string;
  preset: string | null;
  details: string | null;
  ticket_id: string | null;
  reported_at: string;
};

/**
 * "Your building noticed something" (architecture §5.2): Yes / No / Add photo.
 * Leak prompts are urgent and stay pinned at the top until answered.
 */
export function SensorPrompt({ event }: { event: PendingSensorEvent }) {
  const p = presetOf(event);
  const urgent = Boolean(p.emergency);
  const Icon = event.metric === "leak" ? Droplets : event.metric === "temperature" ? Thermometer : BellRing;
  return (
    <Card className={cn("flex flex-col gap-3 p-4 shadow-[var(--shadow-1)]", urgent && "border-emergency")}>
      <span className={cn("label-caps flex items-center gap-2", urgent ? "text-emergency-text" : "text-muted-foreground")}>
        {urgent ? <TriangleAlert className="size-4" aria-hidden /> : <Icon className="size-4" strokeWidth={1.75} aria-hidden />}
        {urgent ? "Urgent · your building noticed something" : "Your building noticed something"}
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg leading-6 font-semibold">{p.question}</h2>
        <p className="text-sm text-muted-foreground">{p.explain}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <form action={answerSensorPrompt.bind(null, event.id, "yes")}>
          <Button className="w-full">Yes</Button>
        </form>
        <form action={answerSensorPrompt.bind(null, event.id, "no")}>
          <Button variant="secondary" className="w-full">
            No
          </Button>
        </form>
        <ButtonLink href={`/app/new?sensor=${event.id}`} variant="secondary" className="px-2">
          Add photo
        </ButtonLink>
      </div>
      <span className="text-xs text-muted-foreground">{timeAgo(event.reported_at)}</span>
    </Card>
  );
}

export type Notice = { id: string; kind: string; title: string; body: string; link: string | null; created_at: string };

const NOTICE_ICON: Record<string, typeof Info> = {
  neighbour_leak: Droplets,
  booked: CalendarClock,
  reminder: CalendarClock,
  technician_late: CalendarClock,
  resolved: Wrench,
  no_access: CalendarClock,
  needs_follow_up: CalendarClock,
};

/** Notices: neighbour warnings, bookings, reminders, technician updates. "Got it" hides one. */
export function NoticeCard({ notice }: { notice: Notice }) {
  const Icon = NOTICE_ICON[notice.kind] ?? Info;
  const warn = notice.kind === "neighbour_leak";
  return (
    <div className={cn("flex gap-3 rounded-xl border px-4 py-3", warn ? "border-high bg-high-tint text-high-text" : "border-border bg-card")}>
      <Icon className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {notice.link ? (
          <Link href={notice.link} className="font-semibold hover:underline">
            {notice.title}
          </Link>
        ) : (
          <span className="font-semibold">{notice.title}</span>
        )}
        {notice.body && <p className={cn("text-sm", !warn && "text-muted-foreground")}>{notice.body}</p>}
        <span className={cn("text-xs", !warn && "text-muted-foreground")}>{timeAgo(notice.created_at)}</span>
      </div>
      <form action={markNoticeRead.bind(null, notice.id)}>
        <button className="min-h-11 rounded-md px-2 text-sm font-semibold hover:bg-black/5">Got it</button>
      </form>
    </div>
  );
}
