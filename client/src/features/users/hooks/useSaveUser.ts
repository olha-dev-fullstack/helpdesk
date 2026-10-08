import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveUser } from "../api";
import { USERS_QUERY_KEY } from "../constants";
import type { User, UserFormValues } from "../types";

/** Creates a user, or updates `user` when given; refreshes the users list on success. */
export function useSaveUser(user?: User) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: UserFormValues) => saveUser(values, user?.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] }),
  });
}
