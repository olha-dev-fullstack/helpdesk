import { Router } from "express";
import { summarizeTicket } from "../controllers/summary";

// Mounted at /api/tickets/:id/summary; mergeParams exposes the ticket id
export const summaryRouter = Router({ mergeParams: true });

summaryRouter.post("/", summarizeTicket);
