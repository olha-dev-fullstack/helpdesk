import axios from "axios";
import type { DashboardStats } from "./types";

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data } = await axios.get<DashboardStats>("/api/stats");
  return data;
}
