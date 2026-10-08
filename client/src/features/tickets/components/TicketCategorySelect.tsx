import { getErrorMessage } from "@/lib/get-error-message";
import { UNCATEGORIZED, editCategoryOptions } from "../constants";
import { useUpdateTicket } from "../hooks/useUpdateTicket";
import type { TicketCategory } from "../types";
import { CategoryOptionLabel } from "./CategoryOptionLabel";
import { OptionSelect } from "./OptionSelect";

export function TicketCategorySelect({
  ticketId,
  category,
}: {
  ticketId: string;
  category: TicketCategory | null;
}) {
  const update = useUpdateTicket(ticketId);

  return (
    <div className="space-y-1">
      <OptionSelect
        label="Ticket category"
        className="w-full"
        value={category ?? UNCATEGORIZED}
        options={editCategoryOptions}
        renderOption={(option) => <CategoryOptionLabel option={option} />}
        disabled={update.isPending}
        onChange={(next) =>
          update.mutate({ category: next === UNCATEGORIZED ? null : next })
        }
      />
      {update.isError && (
        <p role="alert" className="text-sm text-destructive">
          {getErrorMessage(update.error, "Failed to update category")}
        </p>
      )}
    </div>
  );
}
