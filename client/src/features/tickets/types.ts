import type { ALL } from "./constants";

export type TicketStatus = "open" | "resolved" | "closed";
export type TicketCategory =
  | "general_question"
  | "technical_question"
  | "refund_request";

export interface Ticket {
  id: string;
  subject: string;
  fromEmail: string;
  fromName: string | null;
  status: TicketStatus;
  category: TicketCategory | null;
  createdAt: string;
}

export interface Assignee {
  id: string;
  name: string;
}

export interface TicketDetails extends Ticket {
  body: string;
  updatedAt: string;
  assignedTo: Assignee | null;
}

/** Fields that can be changed on a ticket; `null` clears the category or assignee. */
export interface TicketUpdate {
  status?: TicketStatus;
  category?: TicketCategory | null;
  assignedToId?: string | null;
}

export interface TicketsResponse {
  tickets: Ticket[];
  total: number;
  totalPages: number;
}

export interface TicketFilters {
  search: string;
  status: TicketStatus | typeof ALL;
  /** "none" matches tickets that have not been classified yet. */
  category: TicketCategory | "none" | typeof ALL;
}

export interface SelectOption<V extends string = string> {
  value: V;
  label: string;
}
