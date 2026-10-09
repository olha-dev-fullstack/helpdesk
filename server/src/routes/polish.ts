import { Router } from "express";
import { polishReply } from "../controllers/polish";

// Mounted at /api/tickets/:id/replies/polish; mergeParams exposes the ticket id
export const polishRouter = Router({ mergeParams: true });

polishRouter.post("/", polishReply);
