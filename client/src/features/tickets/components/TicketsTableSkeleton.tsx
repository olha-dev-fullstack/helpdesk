import { Skeleton } from "@/components/ui/skeleton";

export function TicketsTableSkeleton() {
  return (
    <div className="space-y-2" aria-label="Loading tickets">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
