import type { Request, Response } from "express";
import { ticketUpdateSchema } from "@core";
import { parseOrReject } from "../lib/validation";
import * as ticketRepository from "../repositories/ticket";
import * as userRepository from "../repositories/user";
import { listQuerySchema } from "../schemas/tickets";
import * as ticketService from "../services/ticket";

export async function listTickets(req: Request, res: Response) {
  const query = parseOrReject(listQuerySchema, req.query, res);
  if (!query) return;
  res.json(await ticketService.listTickets(query));
}

export async function listAssignees(_req: Request, res: Response) {
  res.json({ assignees: await ticketRepository.listAssignees() });
}

export async function getTicket(req: Request, res: Response) {
  const ticket = await ticketRepository.findTicketById(String(req.params.id));
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  res.json({ ticket });
}

export async function updateTicket(req: Request, res: Response) {
  const input = parseOrReject(ticketUpdateSchema, req.body, res);
  if (!input) return;

  if (typeof input.assignedToId === "string") {
    const assignee = await userRepository.findUserRole(input.assignedToId);
    if (!assignee) {
      res.status(400).json({ error: "Assignee not found" });
      return;
    }
    if (assignee.role !== "agent") {
      res.status(400).json({ error: "Tickets can only be assigned to agents" });
      return;
    }
  }

  const ticket = await ticketRepository.updateTicket(String(req.params.id), input);
  if (ticket === "not-found") {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  if (ticket === "no-assignee") {
    res.status(400).json({ error: "Assignee not found" });
    return;
  }
  res.json({ ticket });
}
