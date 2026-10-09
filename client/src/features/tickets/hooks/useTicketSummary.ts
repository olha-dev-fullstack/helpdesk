import { useMutation } from "@tanstack/react-query";
import { getErrorMessage } from "@/lib/get-error-message";
import { summarizeTicket } from "../api";

/** Generates a fresh AI summary on every call; nothing is cached. */
export function useTicketSummary(ticketId: string) {
  const mutation = useMutation({ mutationFn: () => summarizeTicket(ticketId) });

  return {
    summary: mutation.data,
    isSummarizing: mutation.isPending,
    error: mutation.isError ? getErrorMessage(mutation.error, "Failed to summarize ticket") : null,
    summarize: () => mutation.mutate(),
  };
}
