import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeleteUser } from "../hooks/useDeleteUser";
import type { User } from "../types";

export function DeleteUserDialog({
  user,
  onOpenChange,
}: {
  /** The user pending deletion; the dialog is open while this is set. */
  user: User | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { error, isDeleting, confirm, handleOpenChange } = useDeleteUser(
    user,
    onOpenChange,
  );

  return (
    <Dialog open={!!user} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete user</DialogTitle>
          <DialogDescription>
            Delete {user?.name} ({user?.email})? This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={isDeleting} onClick={confirm}>
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
