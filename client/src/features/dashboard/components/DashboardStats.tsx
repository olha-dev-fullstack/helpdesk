import { useDashboardStats } from "../hooks/useDashboardStats";
import { formatDuration } from "../format";
import { StatCard } from "./StatCard";
import { TicketsPerDayChart } from "./TicketsPerDayChart";

export function DashboardStats() {
  const { data, isError } = useDashboardStats();

  if (isError) {
    return (
      <p role="alert" className="text-destructive">
        Failed to load statistics
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total tickets"
          value={data?.totalTickets.toLocaleString()}
        />
        <StatCard
          label="Open tickets"
          value={data?.openTickets.toLocaleString()}
        />
        <StatCard
          label="Resolved by AI"
          value={data?.resolvedByAi.toLocaleString()}
        />
        <StatCard
          label="Resolved by AI (%)"
          value={data && `${data.resolvedByAiPercent}%`}
        />
        <StatCard
          label="Average resolution time"
          value={
            data &&
            (data.averageResolutionSeconds === null
              ? "—"
              : formatDuration(data.averageResolutionSeconds))
          }
        />
      </div>
      <TicketsPerDayChart data={data?.ticketsPerDay} />
    </div>
  );
}
