import { replySchema } from "@core";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { getErrorMessage } from "@/lib/get-error-message";
import { createReply } from "../api";
import { REPLIES_QUERY_KEY } from "../constants";
import type { ReplyFormValues } from "../types";

/** Form state for posting a reply; clears the field and refreshes the thread on success. */
export function useReplyForm(ticketId: string) {
  const queryClient = useQueryClient();
  const form = useForm<ReplyFormValues>({
    resolver: zodResolver(replySchema),
    defaultValues: { body: "" },
  });
  const mutation = useMutation({
    mutationFn: ({ body }: ReplyFormValues) => createReply(ticketId, body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [REPLIES_QUERY_KEY, ticketId] }),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync(values);
    } catch (err) {
      form.setError("root", { message: getErrorMessage(err, "Failed to send reply") });
      return;
    }
    form.reset();
  });

  return { form, onSubmit };
}
