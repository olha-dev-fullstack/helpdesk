import { Skeleton } from "@/components/ui/skeleton";

export function TicketDetailsSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading ticket">
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
