import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DeleteUserDialog } from "@/features/users/components/DeleteUserDialog";
import { UserFormDialog } from "@/features/users/components/UserFormDialog";
import { UsersTable } from "@/features/users/components/UsersTable";
import { UsersTableSkeleton } from "@/features/users/components/UsersTableSkeleton";
import { useUsers } from "@/features/users/hooks/useUsers";
import type { User } from "@/features/users/types";

export default function UsersPage() {
  const { data: users, isPending, isError } = useUsers();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Users</h1>
        <Button onClick={() => setCreateOpen(true)}>New user</Button>
      </div>
      <UserFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <UserFormDialog
        key={editing?.id}
        user={editing ?? undefined}
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
      />
      <DeleteUserDialog
        user={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      />
      {isError ? (
        <p role="alert" className="text-destructive">
          Failed to load users
        </p>
      ) : isPending ? (
        <UsersTableSkeleton />
      ) : users.length === 0 ? (
        <p className="text-muted-foreground">No users found.</p>
      ) : (
        <UsersTable users={users} onEdit={setEditing} onDelete={setDeleting} />
      )}
    </div>
  );
}
