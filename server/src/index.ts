import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import { prisma } from "./lib/prisma";

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
// Better Auth must be mounted before express.json()
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch (err) {
    console.error("Database health check failed:", err);
    res.status(503).json({ status: "error", database: "unreachable" });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
