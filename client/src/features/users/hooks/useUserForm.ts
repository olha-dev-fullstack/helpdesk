import { createUserSchema, editUserSchema } from "@core";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { getErrorMessage } from "@/lib/get-error-message";
import type { User, UserFormValues } from "../types";
import { useSaveUser } from "./useSaveUser";

/** Create/edit form state; edits `user` when given. Closes the dialog after a save. */
export function useUserForm(user: User | undefined, onOpenChange: (open: boolean) => void) {
  const isEdit = !!user;
  const form = useForm<UserFormValues>({
    resolver: zodResolver(isEdit ? editUserSchema : createUserSchema),
    values: { name: user?.name ?? "", email: user?.email ?? "", password: "" },
  });
  const saveUser = useSaveUser(user);

  function handleOpenChange(next: boolean) {
    if (!next) form.reset();
    onOpenChange(next);
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await saveUser.mutateAsync(values);
    } catch (err) {
      form.setError("root", {
        message: getErrorMessage(
          err,
          isEdit ? "Failed to update user" : "Failed to create user",
        ),
      });
      return;
    }
    handleOpenChange(false);
  });

  return { form, isEdit, onSubmit, handleOpenChange };
}
