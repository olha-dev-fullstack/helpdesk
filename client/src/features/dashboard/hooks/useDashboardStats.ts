import { useQuery } from "@tanstack/react-query";
import { fetchDashboardStats } from "../api";
import { DASHBOARD_STATS_QUERY_KEY } from "../constants";

export function useDashboardStats() {
  return useQuery({ queryKey: [DASHBOARD_STATS_QUERY_KEY], queryFn: fetchDashboardStats });
}
