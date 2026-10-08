import type { PaginationState, SortingState } from "@tanstack/react-table";
import axios from "axios";
import { ALL } from "./constants";
import type { Assignee, TicketDetails, TicketUpdate, TicketFilters, TicketsResponse } from "./types";

export interface TicketsQuery {
  sorting: SortingState;
  pagination: PaginationState;
  filters: TicketFilters;
}

export async function fetchTickets({
  sorting,
  pagination: { pageIndex, pageSize },
  filters,
}: TicketsQuery): Promise<TicketsResponse> {
  const [sort] = sorting;
  const { data } = await axios.get<TicketsResponse>("/api/tickets", {
    params: {
      ...(sort && { sortBy: sort.id, order: sort.desc ? "desc" : "asc" }),
      page: pageIndex + 1,
      pageSize,
      ...(filters.search && { search: filters.search }),
      ...(filters.status !== ALL && { status: filters.status }),
      ...(filters.category !== ALL && { category: filters.category }),
    },
  });
  return data;
}

export async function fetchTicket(id: string): Promise<TicketDetails> {
  const { data } = await axios.get<{ ticket: TicketDetails }>(`/api/tickets/${id}`);
  return data.ticket;
}

export async function fetchAssignees(): Promise<Assignee[]> {
  const { data } = await axios.get<{ assignees: Assignee[] }>("/api/tickets/assignees");
  return data.assignees;
}

export async function updateTicket(id: string, update: TicketUpdate): Promise<TicketDetails> {
  const { data } = await axios.patch<{ ticket: TicketDetails }>(`/api/tickets/${id}`, update);
  return data.ticket;
}
