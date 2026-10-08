import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TicketsTableInstance } from "../hooks/useTicketsTable";
import { SortableHeader } from "./SortableHeader";

export function TicketsTable({ table }: { table: TicketsTableInstance }) {
  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id}>
            {group.headers.map((header) => (
              <SortableHeader
                key={header.id}
                sorted={header.column.getIsSorted()}
                onToggle={header.column.getToggleSortingHandler()}
              >
                <table.FlexRender header={header} />
              </SortableHeader>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id}>
            {row.getAllCells().map((cell) => (
              <TableCell key={cell.id}>
                <table.FlexRender cell={cell} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
