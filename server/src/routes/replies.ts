import { Router } from "express";
import { createReply, listReplies } from "../controllers/replies";
import { polishRouter } from "./polish";

// Mounted at /api/tickets/:id/replies; mergeParams exposes the ticket id
export const repliesRouter = Router({ mergeParams: true });

repliesRouter.use("/polish", polishRouter);
repliesRouter.get("/", listReplies);
repliesRouter.post("/", createReply);
