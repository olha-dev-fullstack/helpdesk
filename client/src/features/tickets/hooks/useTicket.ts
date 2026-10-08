import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { fetchTicket } from "../api";
import { TICKETS_QUERY_KEY } from "../constants";

export function useTicket(id: string) {
  const query = useQuery({
    queryKey: [TICKETS_QUERY_KEY, "details", id],
    queryFn: () => fetchTicket(id),
    // A missing ticket won't appear on retry, so show "not found" right away
    retry: false,
  });

  return {
    ...query,
    isNotFound: axios.isAxiosError(query.error) && query.error.response?.status === 404,
  };
}
