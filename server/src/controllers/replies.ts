import type { Request, Response } from "express";
import { replySchema } from "@core";
import { parseOrReject } from "../lib/validation";
import * as replyRepository from "../repositories/reply";
import * as ticketRepository from "../repositories/ticket";

export async function listReplies(req: Request, res: Response) {
  const ticketId = String(req.params.id);
  if (!(await ticketRepository.ticketExists(ticketId))) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  res.json({ replies: await replyRepository.listReplies(ticketId) });
}

export async function createReply(req: Request, res: Response) {
  const input = parseOrReject(replySchema, req.body, res);
  if (!input) return;

  const reply = await replyRepository.createAgentReply({
    ticketId: String(req.params.id),
    authorId: req.user!.id,
    body: input.body,
  });
  if (!reply) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  res.status(201).json({ reply });
}
