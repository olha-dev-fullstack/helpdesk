import { useQuery } from "@tanstack/react-query";
import { fetchReplies } from "../api";
import { REPLIES_QUERY_KEY } from "../constants";

export function useReplies(ticketId: string) {
  return useQuery({
    queryKey: [REPLIES_QUERY_KEY, ticketId],
    queryFn: () => fetchReplies(ticketId),
  });
}
