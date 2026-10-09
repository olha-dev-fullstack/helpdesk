import { prisma } from "../lib/prisma";

export interface DashboardStats {
  totalTickets: number;
  openTickets: number;
  resolvedByAi: number;
  resolvedByAiPercent: number;
  averageResolutionSeconds: number | null;
  ticketsPerDay: { date: string; count: number }[];
}

// All numbers are computed by the dashboard_stats() database function (see its migration)
export async function getDashboardStats(chartDays: number) {
  const [row] = await prisma.$queryRaw<{ stats: DashboardStats }[]>`
    SELECT dashboard_stats(${chartDays}::int) AS stats`;
  return row!.stats;
}
