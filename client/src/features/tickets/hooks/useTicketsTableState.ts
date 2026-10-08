import type { PaginationState, SortingState } from "@tanstack/react-table";
import { useCallback, useState } from "react";
import { DEFAULT_SORTING, PAGE_SIZE } from "../constants";

/** Sorting and pagination state; changing the sort goes back to the first page. */
export function useTicketsTableState() {
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });

  // Stable and idempotent, so it is safe to call from effects
  const resetPage = useCallback(
    () => setPagination((p) => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 })),
    [],
  );

  return { sorting, setSorting, pagination, setPagination, resetPage };
}
