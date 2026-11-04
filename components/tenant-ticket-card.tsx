import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ProgressTracker, IssueIcon } from "@/components/ticket-ui";
import { Card } from "@/components/ui";
import { timeAgo, ticketTitle, type Ticket } from "@/lib/domain";

export function TenantTicketCard({ ticket }: { ticket: Ticket }) {
  const classifying = !ticket.classified_by && ticket.status === "logged";
  return (
    <Link href={`/app/tickets/${ticket.id}`} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-primary">
      <Card className="flex flex-col gap-3 p-4 transition-colors hover:border-primary/40">
        <div className="flex items-start gap-3">
          <IssueIcon type={ticket.issue_type} className="mt-0.5 text-muted-foreground" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-semibold">{classifying ? "New report" : ticketTitle(ticket)}</span>
            <span className="line-clamp-2 text-sm text-muted-foreground">
              {classifying ? "Received, we're on it. Working out what's needed…" : ticket.summary}
            </span>
          </div>
          <span className="flex items-center gap-1 text-xs whitespace-nowrap text-muted-foreground">
            {timeAgo(ticket.created_at)}
            <ChevronRight className="size-4" aria-hidden />
          </span>
        </div>
        <ProgressTracker status={ticket.status} />
      </Card>
    </Link>
  );
}
