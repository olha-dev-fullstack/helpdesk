import type { Prisma } from "../generated/prisma/client";
import * as ticketRepository from "../repositories/ticket";
import type { SortField, TicketListQuery } from "../schemas/tickets";

// Prisma passes `contains` straight into LIKE, so escape the wildcards to match them literally
const escapeLike = (text: string) => text.replace(/[\\%_]/g, "\\$&");

// Nullable columns sort last in both directions; id makes the order total, so pages never overlap
function buildOrderBy(sortBy: SortField, order: "asc" | "desc"): Prisma.TicketOrderByWithRelationInput[] {
  const primary: Prisma.TicketOrderByWithRelationInput[] =
    sortBy === "sender"
      ? [{ fromName: { sort: order, nulls: "last" } }, { fromEmail: order }]
      : sortBy === "category"
        ? [{ category: { sort: order, nulls: "last" } }]
        : [{ [sortBy]: order }];
  return [...primary, { createdAt: "desc" }, { id: "desc" }];
}

export async function listTickets(query: TicketListQuery) {
  const search = query.search && escapeLike(query.search);
  const where: Prisma.TicketWhereInput = {
    ...(query.status && { status: query.status }),
    ...(query.category && { category: query.category === "none" ? null : query.category }),
    ...(search && {
      OR: (["subject", "fromName", "fromEmail", "bodyHtml"] as const).map((field) => ({
        [field]: { contains: search, mode: "insensitive" as const },
      })),
    }),
  };
  const [tickets, total] = await ticketRepository.listTickets({
    where,
    orderBy: buildOrderBy(query.sortBy, query.order),
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  });
  return {
    tickets,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}
