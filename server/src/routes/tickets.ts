import { Router } from "express";
import { z } from "zod";
import { Prisma } from "../generated/prisma/client";
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

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const SORT_FIELDS = ["subject", "sender", "category", "status", "createdAt"] as const;
type SortField = (typeof SORT_FIELDS)[number];

const MAX_SEARCH_LENGTH = 200;

// Prisma passes `contains` straight into LIKE, so escape the wildcards to match them literally
const escapeLike = (text: string) => text.replace(/[\\%_]/g, "\\$&");

const listQuerySchema = z.object({
  status: z.enum(["open", "resolved", "closed"], "Invalid status").optional(),
  // "none" matches tickets that have not been classified yet
  category: z
    .enum(["general_question", "technical_question", "refund_request", "none"], "Invalid category")
    .optional(),
  search: z
    .string("Invalid search")
    .trim()
    .max(MAX_SEARCH_LENGTH, `search must be at most ${MAX_SEARCH_LENGTH} characters`)
    .optional(),
  sortBy: z.enum(SORT_FIELDS, "Invalid sortBy").default("createdAt"),
  order: z.enum(["asc", "desc"], "Invalid order").default("desc"),
  page: z.coerce.number("Invalid page").int("Invalid page").min(1, "Invalid page").default(1),
  pageSize: z.coerce
    .number("Invalid pageSize")
    .int("Invalid pageSize")
    .min(1, "Invalid pageSize")
    .max(MAX_PAGE_SIZE, `pageSize must be at most ${MAX_PAGE_SIZE}`)
    .default(DEFAULT_PAGE_SIZE),
});

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

ticketsRouter.get("/", async (req, res) => {
  const query = parseOrReject(listQuerySchema, req.query, res);
  if (!query) return;

  const search = query.search && escapeLike(query.search);
  const where: Prisma.TicketWhereInput = {
    ...(query.status && { status: query.status }),
    ...(query.category && {
      category: query.category === "none" ? null : query.category,
    }),
    ...(search && {
      OR: (["subject", "fromName", "fromEmail", "body"] as const).map((field) => ({
        [field]: { contains: search, mode: "insensitive" as const },
      })),
    }),
  };
  const [tickets, total] = await prisma.$transaction([
    prisma.ticket.findMany({
      where,
      select: ticketSelect,
      orderBy: buildOrderBy(query.sortBy, query.order),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.ticket.count({ where }),
  ]);
  res.json({
    tickets,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  });
});
