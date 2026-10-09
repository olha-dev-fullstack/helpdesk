import { Router } from "express";
import { getTicket, listAssignees, listTickets, updateTicket } from "../controllers/tickets";
import { repliesRouter } from "./replies";
import { summaryRouter } from "./summary";

export const ticketsRouter = Router();

ticketsRouter.get("/", listTickets);
// Registered before "/:id" so it isn't read as an id
ticketsRouter.get("/assignees", listAssignees);
ticketsRouter.get("/:id", getTicket);
ticketsRouter.patch("/:id", updateTicket);
ticketsRouter.use("/:id/replies", repliesRouter);
ticketsRouter.use("/:id/summary", summaryRouter);
