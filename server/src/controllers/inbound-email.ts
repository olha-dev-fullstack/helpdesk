import crypto from "crypto";
import type { Request, Response } from "express";
import { parseOrReject } from "../lib/validation";
import * as ticketRepository from "../repositories/ticket";
import { inboundEmailSchema } from "../schemas/inbound-email";
import { enqueueClassifyTicket } from "../services/classify";

const NO_SUBJECT = "(no subject)";

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
export async function receiveEmail(req: Request, res: Response) {
  if (!hasValidSecret(req.get("x-webhook-secret"))) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const input = parseOrReject(inboundEmailSchema, req.body, res);
  if (!input) return;

  // The unique index on messageId makes provider retries idempotent
  const ticket = await ticketRepository.createTicket({
    subject: input.subject ?? NO_SUBJECT,
    bodyHtml: input.text,
    fromEmail: input.from,
    fromName: input.fromName,
    messageId: input.messageId,
  });
  if (ticket) {
    // Classified by a queue worker so the webhook never waits on the model
    enqueueClassifyTicket(ticket.id);
    res.status(201).json({ id: ticket.id });
    return;
  }

  const existing = await ticketRepository.findTicketByMessageId(input.messageId!);
  if (!existing) {
    res.status(409).json({ error: "Conflicting change, please retry" });
    return;
  }
  res.status(200).json({ id: existing.id });
}
