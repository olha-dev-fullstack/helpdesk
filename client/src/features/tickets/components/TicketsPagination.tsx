import { Button } from "@/components/ui/button";

export function TicketsPagination({
  pageIndex,
  pageSize,
  shown,
  total,
  totalPages,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
}: {
  pageIndex: number;
  pageSize: number;
  /** Rows on the current page. */
  shown: number;
  total: number;
  totalPages: number;
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const first = pageIndex * pageSize + 1;

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Showing {first}–{first - 1 + shown} of {total}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-sm">
          Page {pageIndex + 1} of {totalPages}
        </span>
        <Button variant="outline" size="sm" onClick={onPrevious} disabled={!canPrevious}>
          Previous
        </Button>
        <Button variant="outline" size="sm" onClick={onNext} disabled={!canNext}>
          Next
        </Button>
      </div>
    </div>
  );
}
