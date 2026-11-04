import Link from "next/link";
import { CalendarClock, Flame, TriangleAlert } from "lucide-react";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { markLandlordNoticeRead } from "@/lib/actions/landlord";
import { timeAgo } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const KINDS = ["emergency", "confirm_booking", "missed_appointment", "building_ticket"];

/** Alerts that need the landlord: emergencies (Book now), manual-mode bookings, missed visits, building-wide tickets. */
export async function DashboardAlerts({ landlordId }: { landlordId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, link, created_at")
    .eq("landlord_id", landlordId)
    .eq("channel", "in_app")
    .in("kind", KINDS)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(4);
  return (
    <>
      <RealtimeRefresh channel={`alerts-${landlordId}`} watch={[{ table: "notifications", filter: `landlord_id=eq.${landlordId}` }]} />
      {data && data.length > 0 && (
        <section aria-label="Alerts" className="flex flex-col gap-2 border-b border-border bg-card px-4 py-3 sm:px-8">
          {data.map((n) => {
            const emergency = n.kind === "emergency";
            const Icon = emergency ? TriangleAlert : n.kind === "building_ticket" ? Flame : CalendarClock;
            return (
              <div
                key={n.id}
                role={emergency ? "alert" : undefined}
                className={cn(
                  "mx-auto flex w-full max-w-6xl items-center gap-3 rounded-lg px-3 py-2",
                  emergency ? "bg-emergency text-white" : "bg-medium-tint text-medium-text",
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link href={n.link ?? "/dashboard"} className="truncate font-semibold hover:underline">
                    {n.title}
                  </Link>
                  <span className="truncate text-sm opacity-90">
                    {n.body} · {timeAgo(n.created_at)}
                  </span>
                </div>
                <form action={markLandlordNoticeRead.bind(null, n.id)}>
                  <button className="min-h-11 rounded-md px-3 text-sm font-semibold hover:bg-black/10">Dismiss</button>
                </form>
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}
