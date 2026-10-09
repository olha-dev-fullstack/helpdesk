import { DEFAULT_PAGE_SIZE, TICKET_CATEGORIES, TICKET_STATUSES } from "@core";
import { z } from "zod";

export const MAX_PAGE_SIZE = 100;
export const MAX_SEARCH_LENGTH = 200;

export const SORT_FIELDS = ["subject", "sender", "category", "status", "createdAt"] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export const listQuerySchema = z.object({
  status: z.enum(TICKET_STATUSES, "Invalid status").optional(),
  // "none" matches tickets that have not been classified yet
  category: z.enum([...TICKET_CATEGORIES, "none"], "Invalid category").optional(),
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

export type TicketListQuery = z.infer<typeof listQuerySchema>;
