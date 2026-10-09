import { Router } from "express";
import { receiveEmail } from "../controllers/inbound-email";

export const inboundEmailRouter = Router();

inboundEmailRouter.post("/", receiveEmail);
