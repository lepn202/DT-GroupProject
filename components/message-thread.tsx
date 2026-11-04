import { Bot } from "lucide-react";
import { formatDateTime } from "@/lib/domain";
import { cn } from "@/lib/utils";

export type Message = { id: string; from: "ai" | "tenant" | "landlord" | "technician"; author_name: string | null; text: string; created_at: string };

const ROLE: Record<Message["from"], string> = { ai: "Assistant", tenant: "Tenant", landlord: "Landlord", technician: "Technician" };

/** One thread per ticket. AI is always labelled "automated"; people get name + role. */
export function MessageThread({ messages, viewer }: { messages: Message[]; viewer: "tenant" | "landlord" }) {
  if (!messages.length) return <p className="text-sm text-muted-foreground">No messages yet.</p>;
  return (
    <ol className="flex flex-col gap-3">
      {messages.map((m) => {
        const own = m.from === viewer;
        return (
          <li key={m.id} className={cn("flex max-w-[85%] flex-col gap-1", own ? "self-end items-end" : "self-start")}>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {m.from === "ai" ? (
                <>
                  <Bot className="size-3.5" aria-hidden /> Automated
                </>
              ) : (
                <>
                  {m.author_name ?? ROLE[m.from]} · {ROLE[m.from]}
                </>
              )}
              <span aria-hidden>·</span>
              <time dateTime={m.created_at}>{formatDateTime(m.created_at)}</time>
            </span>
            <p
              className={cn(
                "rounded-2xl px-4 py-2.5 text-[15px] leading-[22px] whitespace-pre-line",
                own ? "rounded-br-sm bg-primary text-primary-foreground" : m.from === "ai" ? "rounded-bl-sm bg-muted" : "rounded-bl-sm border border-border bg-card",
              )}
            >
              {m.text}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
