import { ALL } from "../constants";
import type { SelectOption, TicketStatus } from "../types";
import { TicketStatusBadge } from "./TicketStatusBadge";

/** A status option as a badge; the "All Statuses" entry stays plain text. */
export function StatusOptionLabel({ option }: { option: SelectOption<TicketStatus | typeof ALL> }) {
  return option.value === ALL ? option.label : <TicketStatusBadge status={option.value} />;
}
