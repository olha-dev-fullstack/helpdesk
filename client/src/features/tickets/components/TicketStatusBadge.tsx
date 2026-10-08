import { Badge } from "@/components/ui/badge";
import { statusBadgeClass, statusLabel } from "../constants";
import type { TicketStatus } from "../types";

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return <Badge className={statusBadgeClass[status]}>{statusLabel[status]}</Badge>;
}
