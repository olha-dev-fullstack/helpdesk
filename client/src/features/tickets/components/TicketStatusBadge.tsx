import { Badge } from "@/components/ui/badge";
import { statusVariant } from "../constants";
import type { TicketStatus } from "../types";

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return <Badge variant={statusVariant[status]}>{status}</Badge>;
}
