import { useParams } from "react-router";
import { BackToTicketsLink } from "@/features/tickets/components/BackToTicketsLink";
import { TicketDetails } from "@/features/tickets/components/TicketDetails";
import { TicketDetailsSkeleton } from "@/features/tickets/components/TicketDetailsSkeleton";
import { useTicket } from "@/features/tickets/hooks/useTicket";

export default function TicketDetailsPage() {
  const { id = "" } = useParams();
  const { data: ticket, isPending, isError, isNotFound } = useTicket(id);

  return (
    <div className="space-y-6">
      <BackToTicketsLink />
      {isNotFound ? (
        <p role="alert" className="text-muted-foreground">
          Ticket not found.
        </p>
      ) : isError ? (
        <p role="alert" className="text-destructive">
          Failed to load ticket
        </p>
      ) : isPending ? (
        <TicketDetailsSkeleton />
      ) : (
        <TicketDetails ticket={ticket} />
      )}
    </div>
  );
}
