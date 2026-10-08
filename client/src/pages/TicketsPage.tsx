import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type TicketStatus = "open" | "resolved" | "closed";

interface Ticket {
  id: string;
  subject: string;
  fromEmail: string;
  fromName: string | null;
  status: TicketStatus;
  createdAt: string;
}

const statusVariant = {
  open: "default",
  resolved: "secondary",
  closed: "outline",
} as const;

async function fetchTickets(): Promise<Ticket[]> {
  const { data } = await axios.get<{ tickets: Ticket[] }>("/api/tickets");
  return data.tickets;
}

export default function TicketsPage() {
  const {
    data: tickets,
    isPending,
    isError,
  } = useQuery({ queryKey: ["tickets"], queryFn: fetchTickets });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Tickets</h1>
      {isError ? (
        <p role="alert" className="text-destructive">
          Failed to load tickets
        </p>
      ) : isPending ? (
        <div className="space-y-2" aria-label="Loading tickets">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <p className="text-muted-foreground">No tickets yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>From</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Received</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((ticket) => (
              <TableRow key={ticket.id}>
                <TableCell className="font-medium">{ticket.subject}</TableCell>
                <TableCell>
                  {ticket.fromName
                    ? `${ticket.fromName} <${ticket.fromEmail}>`
                    : ticket.fromEmail}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[ticket.status]}>{ticket.status}</Badge>
                </TableCell>
                <TableCell>
                  {new Date(ticket.createdAt).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
