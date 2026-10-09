import { prisma } from "../lib/prisma";
import { isPrismaError } from "../lib/prisma-errors";

const replySelect = {
  id: true,
  body: true,
  bodyHtml: true,
  senderType: true,
  createdAt: true,
  author: { select: { id: true, name: true, role: true } },
} as const;

export function listReplies(ticketId: string) {
  return prisma.reply.findMany({
    where: { ticketId },
    select: replySelect,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

// Resolves to null when the ticket does not exist (FK violation)
export function createAgentReply(data: { ticketId: string; authorId: string; body: string }) {
  return prisma.reply
    .create({ data: { ...data, senderType: "agent" }, select: replySelect })
    .catch((err) => {
      if (isPrismaError(err, "P2003")) return null;
      throw err;
    });
}
