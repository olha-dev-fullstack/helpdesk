import type { Request, Response } from "express";
import * as ticketRepository from "../repositories/ticket";
import * as summaryService from "../services/summary";

// Not cached: every request regenerates the summary from the current conversation
export async function summarizeTicket(req: Request, res: Response) {
  const ticket = await ticketRepository.findTicketWithReplies(String(req.params.id));
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  res.json({ summary: await summaryService.summarizeTicket(ticket) });
}
