import { getErrorMessage } from "@/lib/get-error-message";
import { UNASSIGNED } from "../constants";
import { useAssignees } from "../hooks/useAssignees";
import { useUpdateTicket } from "../hooks/useUpdateTicket";
import type { Assignee, SelectOption } from "../types";
import { OptionSelect } from "./OptionSelect";

export function AssigneeSelect({
  ticketId,
  assignee,
}: {
  ticketId: string;
  /** Who the ticket is currently assigned to. */
  assignee: Assignee | null;
}) {
  const { data: assignees = [] } = useAssignees();
  const update = useUpdateTicket(ticketId);

  // Always include the current assignee so their name shows before the list has loaded
  const people = assignee && !assignees.some((a) => a.id === assignee.id)
    ? [assignee, ...assignees]
    : assignees;
  const options: SelectOption[] = [
    { value: UNASSIGNED, label: "Unassigned" },
    ...people.map((a) => ({ value: a.id, label: a.name })),
  ];

  return (
    <div className="space-y-1">
      <OptionSelect
        label="Assign ticket"
        className="w-full"
        value={assignee?.id ?? UNASSIGNED}
        options={options}
        disabled={update.isPending}
        onChange={(value) => update.mutate({ assignedToId: value === UNASSIGNED ? null : value })}
      />
      {update.isError && (
        <p role="alert" className="text-sm text-destructive">
          {getErrorMessage(update.error, "Failed to assign ticket")}
        </p>
      )}
    </div>
  );
}
