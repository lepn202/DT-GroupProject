import Link from "next/link";
import { ArrowLeft, Bot } from "lucide-react";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui";
import { sendChatMessage } from "@/lib/actions/tenant";
import { requireTenant } from "@/lib/auth";
import { formatDateTime } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const STARTERS = ["Why is my room cold?", "When is the technician coming?", "How do I bleed a radiator?", "The quick fix didn't work"];

// The chatbot (architecture §5.6): quick fixes, "why is my room cold?" and status questions.
export default async function AssistantPage() {
  const tenant = await requireTenant();
  const supabase = await createClient();
  const { data } = await supabase.from("chat_messages").select("id, role, text, created_at").eq("tenant_id", tenant.id).order("created_at").limit(100);
  const messages = data ?? [];

  return (
    <>
      <RealtimeRefresh channel={`chat-${tenant.id}`} watch={[{ table: "chat_messages", filter: `tenant_id=eq.${tenant.id}` }]} />
      <Link href="/app/messages" className="flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-primary">
        <ArrowLeft className="size-4" aria-hidden /> Messages
      </Link>
      <header className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Bot className="size-5" aria-hidden />
        </span>
        <div className="flex flex-col">
          <h1 className="text-[22px] leading-7 font-bold">Ask Fixa</h1>
          <span className="text-sm text-muted-foreground">Automated assistant · quick fixes and repair status</span>
        </div>
      </header>

      <ol className="flex flex-col gap-3" aria-live="polite">
        {messages.length === 0 && (
          <li className="max-w-[85%] self-start rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-[15px] leading-[22px]">
            Hi {tenant.name.split(" ")[0]}! I can help with small fixes, tell you where your repairs are, or explain a sensor alert. What&apos;s up?
          </li>
        )}
        {messages.map((m) => {
          const own = m.role === "tenant";
          return (
            <li key={m.id} className={cn("flex max-w-[85%] flex-col gap-1", own ? "items-end self-end" : "self-start")}>
              <span className="text-xs text-muted-foreground">
                {own ? "You" : "Fixa · automated"} · <time dateTime={m.created_at}>{formatDateTime(m.created_at)}</time>
              </span>
              <p
                className={cn(
                  "rounded-2xl px-4 py-2.5 text-[15px] leading-[22px] whitespace-pre-line",
                  own ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted",
                )}
              >
                {m.text}
              </p>
            </li>
          );
        })}
      </ol>

      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {STARTERS.map((q) => (
            <form key={q} action={sendChatMessage}>
              <input type="hidden" name="text" value={q} />
              <button className="min-h-11 rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted">{q}</button>
            </form>
          ))}
        </div>
      )}

      <form action={sendChatMessage} className="sticky bottom-20 flex gap-2 bg-background py-2">
        <Input name="text" placeholder="Ask a question" aria-label="Your question" required autoComplete="off" />
        <SubmitButton pendingText="…">Send</SubmitButton>
      </form>
    </>
  );
}
