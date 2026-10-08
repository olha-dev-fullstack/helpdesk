import { ALL } from "../constants";
import type { SelectOption, TicketCategory } from "../types";
import { TicketCategoryBadge } from "./TicketCategoryBadge";

/** A category option as a badge; "All Categories" and "Uncategorized" stay plain text. */
export function CategoryOptionLabel({
  option,
}: {
  option: SelectOption<TicketCategory | "none" | typeof ALL>;
}) {
  return option.value === ALL || option.value === "none" ? (
    option.label
  ) : (
    <TicketCategoryBadge category={option.value} />
  );
}
