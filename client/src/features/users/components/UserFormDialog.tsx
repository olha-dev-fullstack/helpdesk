import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUserForm } from "../hooks/useUserForm";
import type { User } from "../types";
import { UserFormFields } from "./UserFormFields";

export function UserFormDialog({
  user,
  open,
  onOpenChange,
}: {
  /** When set, the dialog edits this user; otherwise it creates one. */
  user?: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { form, isEdit, onSubmit, handleOpenChange } = useUserForm(user, onOpenChange);
  const {
    register,
    formState: { errors, isSubmitting },
  } = form;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit user" : "New user"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Leave the password blank to keep it unchanged."
              : "Create an agent account. They can sign in with these credentials."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate>
          <UserFormFields
            register={register}
            errors={errors}
            isEdit={isEdit}
            isSubmitting={isSubmitting}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
