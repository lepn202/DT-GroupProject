"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Watch = { table: "tickets" | "messages" | "broadcasts" | "sensor_events" | "appointments" | "notifications" | "chat_messages"; filter?: string };

/**
 * Re-renders the current page when watched rows change (Supabase Realtime, RLS applies),
 * so ticket progress, the dashboard and Home update without a manual refresh.
 */
export function RealtimeRefresh({ channel, watch }: { channel: string; watch: Watch[] }) {
  const router = useRouter();
  const key = JSON.stringify(watch);

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };
    const ch = supabase.channel(channel);
    for (const w of JSON.parse(key) as Watch[]) {
      ch.on("postgres_changes", { event: "*", schema: "public", table: w.table, ...(w.filter ? { filter: w.filter } : {}) }, refresh);
    }
    let cancelled = false;
    // Join with the user's token, not the anon key, or RLS filters out every change.
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      ch.subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") console.warn(`Realtime ${channel}: ${status}`, err?.message ?? "");
      });
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      supabase.removeChannel(ch);
    };
  }, [channel, key, router]);

  return null;
}
