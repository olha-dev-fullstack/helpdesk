import type { EDITABLE_TICKET_STATUSES } from "@core";
import { getErrorMessage } from "@/lib/get-error-message";
import { EDITABLE_STATUSES, editStatusOptions, statusLabel } from "../constants";
import { useUpdateTicket } from "../hooks/useUpdateTicket";
import type { TicketStatus } from "../types";
import { OptionSelect } from "./OptionSelect";
import { StatusOptionLabel } from "./StatusOptionLabel";

export function TicketStatusSelect({
  ticketId,
  status,
}: {
  ticketId: string;
  status: TicketStatus;
}) {
  const update = useUpdateTicket(ticketId);
  // A system-owned status (new/processing) is shown but can't be chosen again
  const options = EDITABLE_STATUSES.includes(status)
    ? editStatusOptions
    : [{ value: status, label: statusLabel[status] }, ...editStatusOptions];

  return (
    <div className="space-y-1">
      <OptionSelect
        label="Ticket status"
        className="w-full"
        value={status}
        options={options}
        renderOption={(option) => <StatusOptionLabel option={option} />}
        disabled={update.isPending}
        onChange={(next) => {
          if (next !== status && EDITABLE_STATUSES.includes(next)) {
            update.mutate({ status: next as (typeof EDITABLE_TICKET_STATUSES)[number] });
          }
        }}
      />
      {update.isError && (
        <p role="alert" className="text-sm text-destructive">
          {getErrorMessage(update.error, "Failed to update status")}
        </p>
      )}
    </div>
  );
}
