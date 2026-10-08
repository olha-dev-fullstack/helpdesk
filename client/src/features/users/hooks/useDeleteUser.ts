import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getErrorMessage } from "@/lib/get-error-message";
import { deleteUser } from "../api";
import { USERS_QUERY_KEY } from "../constants";
import type { User } from "../types";

/**
 * Deletion of `user` with confirm/close handling. `onOpenChange(false)` is called after
 * a successful delete or when the dialog is dismissed.
 */
export function useDeleteUser(user: User | null, onOpenChange: (open: boolean) => void) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] }),
  });

  function handleOpenChange(open: boolean) {
    if (!open) setError(null);
    onOpenChange(open);
  }

  async function confirm() {
    if (!user) return;
    try {
      await mutation.mutateAsync(user.id);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete user"));
      return;
    }
    handleOpenChange(false);
  }

  return { error, isDeleting: mutation.isPending, confirm, handleOpenChange };
}
