import { TicketsPagination } from "@/features/tickets/components/TicketsPagination";
import { TicketsTable } from "@/features/tickets/components/TicketsTable";
import { TicketsTableSkeleton } from "@/features/tickets/components/TicketsTableSkeleton";
import { TicketsToolbar } from "@/features/tickets/components/TicketsToolbar";
import { useTicketsList } from "@/features/tickets/hooks/useTicketsList";

export default function TicketsPage() {
  const { table, filterControls, pagination, data, isError, isPlaceholderData } =
    useTicketsList();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Tickets</h1>
      <TicketsToolbar controls={filterControls} />
      {isError ? (
        <p role="alert" className="text-destructive">
          Failed to load tickets
        </p>
      ) : !data ? (
        <TicketsTableSkeleton />
      ) : data.total === 0 ? (
        <p className="text-muted-foreground">
          {filterControls.hasFilters ? "No tickets match your filters." : "No tickets yet."}
        </p>
      ) : (
        <TicketsTable table={table} />
      )}
      {data && data.total > 0 && (
        <TicketsPagination
          pageIndex={pagination.pageIndex}
          pageSize={pagination.pageSize}
          shown={data.tickets.length}
          total={data.total}
          totalPages={data.totalPages}
          // Don't allow another page change while the next page is still loading
          canPrevious={table.getCanPreviousPage() && !isPlaceholderData}
          canNext={table.getCanNextPage() && !isPlaceholderData}
          onPrevious={() => table.previousPage()}
          onNext={() => table.nextPage()}
        />
      )}
    </div>
  );
}
