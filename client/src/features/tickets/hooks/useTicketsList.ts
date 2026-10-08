import { useTicketFilters } from "./useTicketFilters";
import { useTicketsQuery } from "./useTicketsQuery";
import { useTicketsTable } from "./useTicketsTable";
import { useTicketsTableState } from "./useTicketsTableState";

/** Everything the tickets page needs: filters, server query and the table. */
export function useTicketsList() {
  const tableState = useTicketsTableState();
  const filterControls = useTicketFilters(tableState.resetPage);
  const query = useTicketsQuery({
    sorting: tableState.sorting,
    pagination: tableState.pagination,
    filters: filterControls.filters,
  });
  const table = useTicketsTable(query.data, tableState);

  return {
    table,
    filterControls,
    pagination: tableState.pagination,
    data: query.data,
    isError: query.isError,
    isPlaceholderData: query.isPlaceholderData,
  };
}
