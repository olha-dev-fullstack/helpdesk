import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { TableHead } from "@/components/ui/table";

type SortDirection = false | "asc" | "desc";

const ariaSort = { asc: "ascending", desc: "descending" } as const;

export function SortableHeader({
  sorted,
  onToggle,
  children,
}: {
  sorted: SortDirection;
  onToggle: ((event: unknown) => void) | undefined;
  children: ReactNode;
}) {
  const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <TableHead aria-sort={sorted ? ariaSort[sorted] : "none"}>
      <Button variant="ghost" size="sm" className="-ml-2.5" onClick={onToggle}>
        {children}
        <Icon aria-hidden className={sorted ? "" : "opacity-40"} />
      </Button>
    </TableHead>
  );
}
