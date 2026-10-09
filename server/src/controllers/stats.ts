import type { Request, Response } from "express";
import * as statsRepository from "../repositories/stats";

const CHART_DAYS = 30;

export async function getStats(_req: Request, res: Response) {
  res.json(await statsRepository.getDashboardStats(CHART_DAYS));
}
