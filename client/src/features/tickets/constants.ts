import type { SortingState } from "@tanstack/react-table";
import type {
  SelectOption,
  Ticket,
  TicketCategory,
  TicketFilters,
} from "./types";

/** Sentinel for "no filter" in the select controls. */
export const ALL = "all";

export const TICKETS_QUERY_KEY = "tickets";
export const PAGE_SIZE = 20;
export const SEARCH_DEBOUNCE_MS = 300;

export const NO_TICKETS: Ticket[] = [];
export const NO_FILTERS: TicketFilters = { search: "", status: ALL, category: ALL };
export const DEFAULT_SORTING: SortingState = [{ id: "createdAt", desc: true }];

export const statusVariant = {
  open: "default",
  resolved: "secondary",
  closed: "outline",
} as const;

export const categoryLabel: Record<TicketCategory, string> = {
  general_question: "General question",
  technical_question: "Technical question",
  refund_request: "Refund request",
};

export const statusOptions: SelectOption<TicketFilters["status"]>[] = [
  { value: ALL, label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

export const categoryOptions: SelectOption<TicketFilters["category"]>[] = [
  { value: ALL, label: "All categories" },
  { value: "general_question", label: categoryLabel.general_question },
  { value: "technical_question", label: categoryLabel.technical_question },
  { value: "refund_request", label: categoryLabel.refund_request },
  { value: "none", label: "Uncategorized" },
];
