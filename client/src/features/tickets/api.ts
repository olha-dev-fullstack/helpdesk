import type { PaginationState, SortingState } from "@tanstack/react-table";
import axios from "axios";
import { ALL } from "./constants";
import type { Assignee, Reply, TicketDetails, TicketUpdate, TicketFilters, TicketsResponse } from "./types";

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

export async function fetchReplies(ticketId: string): Promise<Reply[]> {
  const { data } = await axios.get<{ replies: Reply[] }>(`/api/tickets/${ticketId}/replies`);
  return data.replies;
}

export async function createReply(ticketId: string, body: string): Promise<Reply> {
  const { data } = await axios.post<{ reply: Reply }>(`/api/tickets/${ticketId}/replies`, { body });
  return data.reply;
}

export async function polishReply(ticketId: string, body: string): Promise<string> {
  const { data } = await axios.post<{ body: string }>(`/api/tickets/${ticketId}/replies/polish`, { body });
  return data.body;
}

export async function summarizeTicket(ticketId: string): Promise<string> {
  const { data } = await axios.post<{ summary: string }>(`/api/tickets/${ticketId}/summary`);
  return data.summary;
}
