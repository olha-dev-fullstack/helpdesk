import { z } from "zod";
import { MAX_REPLY_LENGTH } from "./constants";

export const TICKET_STATUSES = ["open", "resolved", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_CATEGORIES = [
  "general_question",
  "technical_question",
  "refund_request",
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const SENDER_TYPES = ["agent", "customer"] as const;
export type SenderType = (typeof SENDER_TYPES)[number];

export const replySchema = z.object({
  body: z
    .string("Reply is required")
    .trim()
    .min(1, "Reply is required")
    .max(MAX_REPLY_LENGTH, `Reply must be at most ${MAX_REPLY_LENGTH} characters`),
});

// Any subset of these fields; `null` clears the category or the assignee
export const ticketUpdateSchema = z
  .object({
    status: z.enum(TICKET_STATUSES, "Invalid status").optional(),
    category: z.enum(TICKET_CATEGORIES, "Invalid category").nullable().optional(),
    assignedToId: z
      .string("Invalid assignedToId")
      .min(1, "Invalid assignedToId")
      .nullable()
      .optional(),
  })
  .refine(
    (v) => Object.values(v).some((x) => x !== undefined),
    "Provide status, category or assignedToId",
  );

export type TicketUpdate = z.infer<typeof ticketUpdateSchema>;
