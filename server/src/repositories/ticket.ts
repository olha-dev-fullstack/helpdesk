import type { TicketCategory, TicketUpdate } from "@core";
import type { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { isPrismaError } from "../lib/prisma-errors";

const ticketSelect = {
  id: true,
  subject: true,
  fromEmail: true,
  fromName: true,
  status: true,
  category: true,
  createdAt: true,
} as const;

const ticketDetailSelect = {
  ...ticketSelect,
  bodyHtml: true,
  updatedAt: true,
  assignedTo: { select: { id: true, name: true } },
} as const;

export function listTickets(params: {
  where: Prisma.TicketWhereInput;
  orderBy: Prisma.TicketOrderByWithRelationInput[];
  skip: number;
  take: number;
}) {
  const { where, orderBy, skip, take } = params;
  return prisma.$transaction([
    prisma.ticket.findMany({ where, select: ticketSelect, orderBy, skip, take }),
    prisma.ticket.count({ where }),
  ]);
}

export function findTicketById(id: string) {
  return prisma.ticket.findUnique({ where: { id }, select: ticketDetailSelect });
}

export async function ticketExists(id: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id }, select: { id: true } });
  return ticket !== null;
}

// Ticket plus its replies, as input for AI summaries
export function findTicketWithReplies(id: string) {
  return prisma.ticket.findUnique({
    where: { id },
    select: {
      subject: true,
      fromName: true,
      bodyHtml: true,
      replies: {
        select: { body: true, senderType: true, author: { select: { name: true } } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
  });
}

export function findTicketContext(id: string) {
  return prisma.ticket.findUnique({ where: { id }, select: { subject: true, fromName: true } });
}

export function findTicketByMessageId(messageId: string) {
  return prisma.ticket.findUnique({ where: { messageId }, select: { id: true } });
}

// Resolves to null when the messageId already exists (provider retry)
export function createTicket(data: {
  subject: string;
  bodyHtml: string;
  fromEmail: string;
  fromName: string | null;
  messageId: string | null;
}) {
  return prisma.ticket
    .create({ data, select: { id: true, subject: true, bodyHtml: true } })
    .catch((err) => {
      if (isPrismaError(err, "P2002")) return null;
      throw err;
    });
}

// The FK guards against the assignee being deleted after the controller's check
export function updateTicket(id: string, data: TicketUpdate) {
  return prisma.ticket
    .update({ where: { id }, data, select: ticketDetailSelect })
    .catch((err) => {
      if (isPrismaError(err, "P2025")) return "not-found" as const;
      if (isPrismaError(err, "P2003")) return "no-assignee" as const;
      throw err;
    });
}

export function listAssignees() {
  return prisma.user.findMany({
    where: { role: "agent" },
    select: { id: true, name: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

export function findTicketForClassification(id: string) {
  return prisma.ticket.findUnique({ where: { id }, select: { subject: true, bodyHtml: true, category: true } });
}

// Only fills an empty category, so a manual choice made meanwhile is never overwritten
export function setCategoryIfUnset(id: string, category: TicketCategory) {
  return prisma.ticket.updateMany({ where: { id, category: null }, data: { category } });
}
