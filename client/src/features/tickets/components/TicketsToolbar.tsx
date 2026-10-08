import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { categoryOptions, statusOptions } from "../constants";
import type { TicketFilterControls } from "../hooks/useTicketFilters";
import { FilterSelect } from "./FilterSelect";

export function TicketsToolbar({ controls }: { controls: TicketFilterControls }) {
  const { searchInput, setSearchInput, filters, setStatus, setCategory, hasFilters, clear } =
    controls;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-72">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Search tickets"
          placeholder="Search subject, sender or message"
          className="pl-8"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>
      <FilterSelect
        label="Filter by status"
        className="w-40"
        value={filters.status}
        options={statusOptions}
        onChange={setStatus}
      />
      <FilterSelect
        label="Filter by category"
        className="w-48"
        value={filters.category}
        options={categoryOptions}
        onChange={setCategory}
      />
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
