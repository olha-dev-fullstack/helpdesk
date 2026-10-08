import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { parseOrReject } from "../lib/validation";

export const ticketsRouter = Router();

const ticketSelect = {
  id: true,
  subject: true,
  fromEmail: true,
  fromName: true,
  status: true,
  category: true,
  createdAt: true,
} as const;

const listQuerySchema = z.object({
  status: z.enum(["open", "resolved", "closed"], "Invalid status").optional(),
});

ticketsRouter.get("/", async (req, res) => {
  const query = parseOrReject(listQuerySchema, req.query, res);
  if (!query) return;

  const tickets = await prisma.ticket.findMany({
    where: query.status ? { status: query.status } : undefined,
    select: ticketSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json({ tickets });
});
