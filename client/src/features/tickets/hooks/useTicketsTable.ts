import { useTable } from "@tanstack/react-table";
import { ticketColumns, ticketTableFeatures } from "../columns";
import { NO_TICKETS } from "../constants";
import type { TicketsResponse } from "../types";
import type { useTicketsTableState } from "./useTicketsTableState";

type TableState = ReturnType<typeof useTicketsTableState>;

export type TicketsTableInstance = ReturnType<typeof useTicketsTable>;

/** TanStack table whose rows are sorted and paged by the server. */
export function useTicketsTable(
  data: TicketsResponse | undefined,
  { sorting, setSorting, pagination, setPagination, resetPage }: TableState,
) {
  return useTable({
    features: ticketTableFeatures,
    data: data?.tickets ?? NO_TICKETS,
    columns: ticketColumns,
    state: { sorting, pagination },
    onSortingChange: (updater) => {
      setSorting(updater);
      // A different order makes the current page meaningless
      resetPage();
    },
    onPaginationChange: setPagination,
    manualPagination: true,
    rowCount: data?.total,
    manualSorting: true,
    enableSortingRemoval: false,
    enableMultiSort: false,
    sortDescFirst: false,
    getRowId: (t) => t.id,
  });
}
