import * as Sentry from "@sentry/bun";

// Must be imported first in index.ts. Without SENTRY_DSN the SDK stays disabled.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",
  // Error logging only: no tracing configured
});
