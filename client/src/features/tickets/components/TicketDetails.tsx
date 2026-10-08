import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { categoryLabel } from "../constants";
import type { TicketDetails as TicketDetailsData } from "../types";
import { TicketStatusBadge } from "./TicketStatusBadge";

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

export function TicketDetails({ ticket }: { ticket: TicketDetailsData }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold">{ticket.subject}</h1>
        <TicketStatusBadge status={ticket.status} />
      </div>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Detail label="Sender">
          <div>{ticket.fromName ?? "Unknown"}</div>
          <div className="text-sm text-muted-foreground">{ticket.fromEmail}</div>
        </Detail>
        <Detail label="Category">
          {ticket.category ? categoryLabel[ticket.category] : "—"}
        </Detail>
        <Detail label="Assigned to">{ticket.assignedTo?.name ?? "Unassigned"}</Detail>
        <Detail label="Created">{new Date(ticket.createdAt).toLocaleString()}</Detail>
      </dl>
      <Card>
        <CardHeader>
          <CardTitle>Message</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap break-words">{ticket.body}</p>
        </CardContent>
      </Card>
    </div>
  );
}
