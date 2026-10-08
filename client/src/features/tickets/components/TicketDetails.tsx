import DOMPurify from "dompurify";
import { Card,CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TicketDetails as TicketDetailsData } from "../types";
import { AssigneeSelect } from "./AssigneeSelect";
import { ReplyThread } from "./ReplyThread";
import { TicketCategoryBadge } from "./TicketCategoryBadge";
import { TicketCategorySelect } from "./TicketCategorySelect";
import { TicketStatusBadge } from "./TicketStatusBadge";
import { TicketStatusSelect } from "./TicketStatusSelect";

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

/** Left column reads the ticket; the right column changes it. */
export function TicketDetails({ ticket }: { ticket: TicketDetailsData }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-6">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold">{ticket.subject}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <TicketStatusBadge status={ticket.status} />
            <TicketCategoryBadge category={ticket.category} />
          </div>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail label="Sender">
            <div>{ticket.fromName ?? "Unknown"}</div>
            <div className="text-sm text-muted-foreground">{ticket.fromEmail}</div>
          </Detail>
          <Detail label="Created">{new Date(ticket.createdAt).toLocaleString()}</Detail>
        </dl>
        <Card>
          <CardHeader>
            <CardTitle>Message</CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className="whitespace-pre-wrap break-words"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(ticket.body) }}
            />
          </CardContent>
        </Card>
        <ReplyThread ticketId={ticket.id} />
      </div>
      <Card className="self-start">
        <CardHeader>
          <CardTitle>Manage ticket</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-4">
            <Detail label="Status">
              <TicketStatusSelect ticketId={ticket.id} status={ticket.status} />
            </Detail>
            <Detail label="Category">
              <TicketCategorySelect ticketId={ticket.id} category={ticket.category} />
            </Detail>
            <Detail label="Assigned to">
              <AssigneeSelect ticketId={ticket.id} assignee={ticket.assignedTo} />
            </Detail>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
