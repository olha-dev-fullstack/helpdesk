import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import type { User } from "../types";

export function UserRow({
  user,
  onEdit,
  onDelete,
}: {
  user: User;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium">{user.name}</TableCell>
      <TableCell>{user.email}</TableCell>
      <TableCell>
        <Badge variant={user.role === "admin" ? "default" : "secondary"}>{user.role}</Badge>
      </TableCell>
      <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
      <TableCell className="space-x-2 text-right">
        <Button
          variant="outline"
          size="sm"
          aria-label={`Edit ${user.name}`}
          onClick={() => onEdit(user)}
        >
          Edit
        </Button>
        <Button
          variant="destructive"
          size="sm"
          aria-label={`Delete ${user.name}`}
          onClick={() => onDelete(user)}
        >
          Delete
        </Button>
      </TableCell>
    </TableRow>
  );
}
