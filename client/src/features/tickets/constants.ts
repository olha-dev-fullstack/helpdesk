import type { SortingState } from "@tanstack/react-table";
import type {
  SelectOption,
  Ticket,
  TicketCategory,
  TicketFilters,
  TicketStatus,
} from "./types";

/** Sentinel for "no filter" in the select controls. */
export const ALL = "all";

export const TICKETS_QUERY_KEY = "tickets";
export const ASSIGNEES_QUERY_KEY = "ticket-assignees";

/** Select value meaning "no assignee". */
export const UNASSIGNED = "unassigned";
export const TICKETS_PATH = "/tickets";
export const ticketPath = (id: string) => `${TICKETS_PATH}/${id}`;

export const PAGE_SIZE = 20;
export const SEARCH_DEBOUNCE_MS = 300;

export const NO_TICKETS: Ticket[] = [];
export const NO_FILTERS: TicketFilters = { search: "", status: ALL, category: ALL };
export const DEFAULT_SORTING: SortingState = [{ id: "createdAt", desc: true }];

export const statusLabel: Record<TicketStatus, string> = {
  open: "Open",
  resolved: "Resolved",
  closed: "Closed",
};

export const categoryLabel: Record<TicketCategory, string> = {
  general_question: "General Question",
  technical_question: "Technical Question",
  refund_request: "Refund Request",
};

// Badge colors: soft tinted background in light mode, translucent in dark mode
export const statusBadgeClass: Record<TicketStatus, string> = {
  open: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300",
  resolved: "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300",
  closed: "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
};

export const categoryBadgeClass: Record<TicketCategory, string> = {
  general_question: "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-300",
  technical_question: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
  refund_request: "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300",
};

export const statusOptions: SelectOption<TicketFilters["status"]>[] = [
  { value: ALL, label: "All Statuses" },
  { value: "open", label: statusLabel.open },
  { value: "resolved", label: statusLabel.resolved },
  { value: "closed", label: statusLabel.closed },
];

export const categoryOptions: SelectOption<TicketFilters["category"]>[] = [
  { value: ALL, label: "All Categories" },
  { value: "general_question", label: categoryLabel.general_question },
  { value: "technical_question", label: categoryLabel.technical_question },
  { value: "refund_request", label: categoryLabel.refund_request },
  { value: "none", label: "Uncategorized" },
];

// Options for editing a ticket (the filter options minus "All ...")
export const editStatusOptions = statusOptions.filter((o) => o.value !== ALL) as SelectOption<
  Exclude<TicketFilters["status"], typeof ALL>
>[];
export const editCategoryOptions = categoryOptions.filter((o) => o.value !== ALL) as SelectOption<
  Exclude<TicketFilters["category"], typeof ALL>
>[];

/** Select value meaning "no category" when editing a ticket. */
export const UNCATEGORIZED = "none";
