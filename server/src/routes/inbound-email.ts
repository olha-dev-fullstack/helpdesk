import crypto from "crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { isPrismaError } from "../lib/prisma-errors";
import { parseOrReject } from "../lib/validation";

export const inboundEmailRouter = Router();

const MAX_EMAIL_LENGTH = 254;
const MAX_NAME_LENGTH = 200;
const MAX_SUBJECT_LENGTH = 300;
const MAX_BODY_LENGTH = 100_000;
const MAX_MESSAGE_ID_LENGTH = 998;
const NO_SUBJECT = "(no subject)";

// Optional trimmed string: empty/null/missing become null
const optionalText = (max: number, name: string) =>
  z
    .string()
    .max(max, `${name} is too long`)
    .nullish()
    .transform((v) => v?.trim() || null);

const inboundEmailSchema = z.object(
  {
    from: z
      .string()
      .trim()
      .toLowerCase()
      .max(MAX_EMAIL_LENGTH, "from must be a valid email address")
      .pipe(z.email("from must be a valid email address")),
    fromName: optionalText(MAX_NAME_LENGTH, "fromName"),
    subject: optionalText(MAX_SUBJECT_LENGTH, "subject"),
    text: z
      .string()
      .max(MAX_BODY_LENGTH, "text is too long")
      .trim()
      .min(1, "text must not be empty"),
    messageId: optionalText(MAX_MESSAGE_ID_LENGTH, "messageId"),
  },
  "from and text are required",
);

const secret = process.env.INBOUND_EMAIL_SECRET;
if (!secret || secret.length < 32) {
  throw new Error("INBOUND_EMAIL_SECRET must be set to at least 32 characters");
}
const secretDigest = crypto.createHash("sha256").update(secret).digest();

function hasValidSecret(header: unknown) {
  if (typeof header !== "string") return false;
  const digest = crypto.createHash("sha256").update(header).digest();
  return crypto.timingSafeEqual(digest, secretDigest);
}

// Provider-agnostic JSON: { from, fromName?, subject?, text, messageId? }
inboundEmailRouter.post("/", async (req, res) => {
  if (!hasValidSecret(req.get("x-webhook-secret"))) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const input = parseOrReject(inboundEmailSchema, req.body, res);
  if (!input) return;

  const normalizedMessageId = input.messageId;
  const data = {
    subject: input.subject ?? NO_SUBJECT,
    bodyHtml: input.text,
    fromEmail: input.from,
    fromName: input.fromName,
    messageId: normalizedMessageId,
  };

  // The unique index on messageId makes provider retries idempotent
  const ticket = await prisma.ticket
    .create({ data, select: { id: true } })
    .catch((err) => {
      if (isPrismaError(err, "P2002")) return null;
      throw err;
    });
  if (ticket) {
    res.status(201).json({ id: ticket.id });
    return;
  }

  const existing = await prisma.ticket.findUnique({
    where: { messageId: normalizedMessageId! },
    select: { id: true },
  });
  if (!existing) {
    res.status(409).json({ error: "Conflicting change, please retry" });
    return;
  }
  res.status(200).json({ id: existing.id });
});
