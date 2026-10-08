import { useEffect, useState } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ALL, SEARCH_DEBOUNCE_MS } from "../constants";
import type { TicketFilters } from "../types";

export type TicketFilterControls = ReturnType<typeof useTicketFilters>;

/**
 * Search text plus status/category filters. The input updates instantly while the
 * `filters` sent to the server follow once typing pauses. `onChange` fires whenever the
 * result set changes (so the caller can go back to page 1).
 */
export function useTicketFilters(onChange: () => void) {
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState<TicketFilters["status"]>(ALL);
  const [category, setCategory] = useState<TicketFilters["category"]>(ALL);

  const trimmed = searchInput.trim();
  const debounced = useDebouncedValue(trimmed, SEARCH_DEBOUNCE_MS);
  // Clearing the box applies immediately; typing waits for the pause
  const search = trimmed === "" ? "" : debounced;

  const filters: TicketFilters = { search, status, category };

  useEffect(onChange, [search, status, category, onChange]);

  const hasFilters = searchInput !== "" || status !== ALL || category !== ALL;

  function clear() {
    setSearchInput("");
    setStatus(ALL);
    setCategory(ALL);
  }

  return {
    filters,
    searchInput,
    setSearchInput,
    setStatus,
    setCategory,
    hasFilters,
    clear,
  };
}
