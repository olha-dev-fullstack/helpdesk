import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { isPrismaError } from "../lib/prisma-errors";
import { parseOrReject } from "../lib/validation";

// Mounted at /api/tickets/:id/replies; mergeParams exposes the ticket id
export const repliesRouter = Router({ mergeParams: true });

const MAX_REPLY_LENGTH = 10_000;

const replySelect = {
  id: true,
  body: true,
  senderType: true,
  createdAt: true,
  author: { select: { id: true, name: true, role: true } },
} as const;

repliesRouter.get<{ id: string }>("/", async (req, res) => {
  const id = req.params.id;
  const ticket = await prisma.ticket.findUnique({ where: { id }, select: { id: true } });
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  const replies = await prisma.reply.findMany({
    where: { ticketId: id },
    select: replySelect,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  res.json({ replies });
});

const replySchema = z.object({
  body: z
    .string("Reply is required")
    .trim()
    .min(1, "Reply is required")
    .max(MAX_REPLY_LENGTH, `Reply must be at most ${MAX_REPLY_LENGTH} characters`),
});

repliesRouter.post<{ id: string }>("/", async (req, res) => {
  const input = parseOrReject(replySchema, req.body, res);
  if (!input) return;

  const reply = await prisma.reply
    .create({
      data: { body: input.body, senderType: "agent", ticketId: req.params.id, authorId: req.user!.id },
      select: replySelect,
    })
    .catch((err) => {
      if (isPrismaError(err, "P2003")) return null;
      throw err;
    });
  if (!reply) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  res.status(201).json({ reply });
});
