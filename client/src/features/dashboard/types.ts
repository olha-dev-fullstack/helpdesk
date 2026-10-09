export interface DailyTicketCount {
  /** UTC day, YYYY-MM-DD */
  date: string;
  count: number;
}

export interface DashboardStats {
  totalTickets: number;
  openTickets: number;
  resolvedByAi: number;
  resolvedByAiPercent: number;
  /** null until at least one ticket has been resolved */
  averageResolutionSeconds: number | null;
  /** Last 30 days, oldest first, zero-filled */
  ticketsPerDay: DailyTicketCount[];
}
