import { Badge } from "@/components/ui/badge";
import { categoryBadgeClass, categoryLabel } from "../constants";
import type { TicketCategory } from "../types";

/** The category as a colored badge, or "—" while the ticket is unclassified. */
export function TicketCategoryBadge({ category }: { category: TicketCategory | null }) {
  if (!category) return <>—</>;
  return <Badge className={categoryBadgeClass[category]}>{categoryLabel[category]}</Badge>;
}
