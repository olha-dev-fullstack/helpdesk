import type { ErrorRequestHandler } from "express";

// Generic handler so errors never leak stack traces to clients
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Client mistakes from body-parser are not server errors
  if (err.type === "entity.parse.failed") {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }
  if (err.type === "entity.too.large") {
    res.status(413).json({ error: "Request body too large" });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};
