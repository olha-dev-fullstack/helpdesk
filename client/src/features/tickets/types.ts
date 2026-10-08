import type { ALL } from "./constants";

import type { SenderType, TicketCategory, TicketStatus } from "@core";

export type { SenderType, TicketCategory, TicketStatus, TicketUpdate } from "@core";

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

export interface Reply {
  id: string;
  body: string;
  senderType: SenderType;
  createdAt: string;
  /** `null` when the author's account has since been deleted. */
  author: (Assignee & { role: "admin" | "agent" }) | null;
}

export interface ReplyFormValues {
  body: string;
}
