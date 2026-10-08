import type { Response } from "express";
import type { z } from "zod";

// Parses `data` with `schema`; on failure sends a 400 with the first issue's message and returns null
export function parseOrReject<T extends z.ZodType>(
  schema: T,
  data: unknown,
  res: Response,
  status = 400,
): z.infer<T> | null {
  const result = schema.safeParse(data ?? {});
  if (result.success) return result.data;
  res.status(status).json({ error: result.error.issues[0]?.message ?? "Invalid request" });
  return null;
}
