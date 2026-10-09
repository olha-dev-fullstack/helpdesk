import type { Request, Response } from "express";
import { polishSchema } from "@core";
import { parseOrReject } from "../lib/validation";
import * as ticketRepository from "../repositories/ticket";
import * as polishService from "../services/polish";

export async function polishReply(req: Request, res: Response) {
  const input = parseOrReject(polishSchema, req.body, res);
  if (!input) return;

  const ticket = await ticketRepository.findTicketContext(String(req.params.id));
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  res.json({ body: await polishService.polishReply(ticket, input.body) });
}
