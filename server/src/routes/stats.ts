import { Router } from "express";
import { getStats } from "../controllers/stats";

export const statsRouter = Router();

statsRouter.get("/", getStats);
