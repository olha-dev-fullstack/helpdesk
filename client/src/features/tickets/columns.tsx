import {
  createColumnHelper,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
} from "@tanstack/react-table";
import { Link } from "react-router";
import { SenderCell } from "./components/SenderCell";
import { TicketStatusBadge } from "./components/TicketStatusBadge";
import { categoryLabel, ticketPath } from "./constants";
import type { Ticket } from "./types";

export const ticketTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
});
const columnHelper = createColumnHelper<typeof ticketTableFeatures, Ticket>();

// Column ids are the `sortBy` values the server accepts.
// Accessors (even unused ones) make a column sortable; the server does the sorting.
export const ticketColumns = columnHelper.columns([
  columnHelper.accessor("subject", {
    id: "subject",
    header: "Subject",
    cell: ({ row }) => (
      <Link
        to={ticketPath(row.original.id)}
        className="font-medium underline-offset-4 hover:underline"
      >
        {row.original.subject}
      </Link>
    ),
  }),
  columnHelper.accessor((t) => t.fromName ?? t.fromEmail, {
    id: "sender",
    header: "Sender",
    cell: ({ row }) => (
      <SenderCell name={row.original.fromName} email={row.original.fromEmail} />
    ),
  }),
  columnHelper.accessor((t) => t.category, {
    id: "category",
    header: "Category",
    cell: ({ row }) =>
      row.original.category ? categoryLabel[row.original.category] : "—",
  }),
  columnHelper.accessor((t) => t.status, {
    id: "status",
    header: "Status",
    cell: ({ row }) => <TicketStatusBadge status={row.original.status} />,
  }),
  columnHelper.accessor("createdAt", {
    id: "createdAt",
    header: "Created",
    cell: (info) => new Date(info.getValue()).toLocaleString(),
  }),
]);
