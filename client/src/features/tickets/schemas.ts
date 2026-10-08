import { z } from "zod";
import { MAX_REPLY_LENGTH } from "./constants";

export const replySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Reply is required")
    .max(MAX_REPLY_LENGTH, `Reply must be at most ${MAX_REPLY_LENGTH} characters`),
});
