import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateTicket } from "../api";
import { TICKETS_QUERY_KEY } from "../constants";
import type { TicketUpdate } from "../types";

/** Changes a ticket's status, category or assignee and refreshes the ticket queries. */
export function useUpdateTicket(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (update: TicketUpdate) => updateTicket(ticketId, update),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [TICKETS_QUERY_KEY] }),
  });
}
