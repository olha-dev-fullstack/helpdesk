import { getErrorMessage } from "@/lib/get-error-message";
import { editStatusOptions } from "../constants";
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

  return (
    <div className="space-y-1">
      <OptionSelect
        label="Ticket status"
        className="w-full"
        value={status}
        options={editStatusOptions}
        renderOption={(option) => <StatusOptionLabel option={option} />}
        disabled={update.isPending}
        onChange={(next) => update.mutate({ status: next })}
      />
      {update.isError && (
        <p role="alert" className="text-sm text-destructive">
          {getErrorMessage(update.error, "Failed to update status")}
        </p>
      )}
    </div>
  );
}
