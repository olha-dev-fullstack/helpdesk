import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { auth, trustedOrigins } from "./lib/auth";
import { prisma } from "./lib/prisma";
import { boss } from "./lib/queue";
import { startClassifyWorker } from "./services/classify";
import { startResolveWorker } from "./services/resolve";
import { requireAdmin } from "./middlewares/require-admin";
import { requireAuth } from "./middlewares/require-auth";
import { inboundEmailRouter } from "./routes/inbound-email";
import { statsRouter } from "./routes/stats";
import { ticketsRouter } from "./routes/tickets";
import { usersRouter } from "./routes/users";
import { errorHandler } from "./lib/errorHandler";

const app = express();
const port = process.env.PORT || 3000;

app.use(helmet());
app.use(cors({ origin: trustedOrigins, credentials: true }));
// Better Auth must be mounted before express.json()
app.all("/api/auth/*splat", toNodeHandler(auth));

// Small cap: the largest legitimate payload is an inbound email body (<= 100k chars)
app.use(express.json({ limit: "256kb" }));

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: req.user, session: req.session });
});

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch (err) {
    console.error("Database health check failed:", err);
    res.status(503).json({ status: "error", database: "unreachable" });
  }
});

// Public, authenticated by shared secret instead of a session
app.use("/api/webhooks/inbound-email", inboundEmailRouter);

// Everything below requires a session; register public routes above this line
app.use("/api", requireAuth);
// Admin-only routes: mount their routers after this guard
app.use("/api/users", requireAdmin);
app.use("/api/users", usersRouter);
app.use("/api/stats", statsRouter);
app.use("/api/tickets", ticketsRouter);

app.use(errorHandler);

const server = app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

await boss.start();
await startClassifyWorker();
await startResolveWorker();

async function shutdown() {
  server.close();
  await boss.stop();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
