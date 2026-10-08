import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchTickets, type TicketsQuery } from "../api";
import { TICKETS_QUERY_KEY } from "../constants";

export function useTicketsQuery(query: TicketsQuery) {
  return useQuery({
    queryKey: [TICKETS_QUERY_KEY, query.sorting, query.pagination, query.filters],
    queryFn: () => fetchTickets(query),
    // Keep the old rows on screen while the next page / order loads
    placeholderData: keepPreviousData,
  });
}
