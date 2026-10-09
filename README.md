# Helpdesk

AI-powered ticket management. Support emails become tickets, which are classified and, when the knowledge base covers them, answered automatically. Everything else goes to human agents, who get AI summaries and reply polishing.

## Features

- Inbound email webhook creates tickets
- AI classification (general / technical / refund) via a pg-boss queue
- AI auto-resolve from `server/knowledge-base.md`, with escalation to humans when not covered
- Ticket list with filtering and sorting, ticket detail with reply history
- AI ticket summary and reply polish
- Dashboard: totals, resolved-by-AI share, average resolution time, 30-day chart
- Admin-only user management (admins create agents; there is no public sign-up)

## Tech stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, TanStack Query
- **Backend:** Express 5, TypeScript, Bun
- **Database:** PostgreSQL, Prisma 7
- **Auth:** Better Auth (email/password, database sessions)
- **AI:** Vercel AI SDK through the AI Gateway
- **Monitoring:** Sentry

## Project structure

```
client/   React frontend (port 5173 in dev)
server/   Express API (port 3000)
core/     Zod schemas and constants shared by both, imported as @core
e2e/      Playwright tests
```

## Getting started

Requires [Bun](https://bun.sh) and Docker.

```bash
# 1. Database
docker compose up -d db

# 2. Install dependencies
(cd core && bun install)
(cd server && bun install)
(cd client && bun install)

# 3. Configure the server
cp server/.env.example server/.env
#    fill in BETTER_AUTH_SECRET, INBOUND_EMAIL_SECRET (both 32+ chars,
#    e.g. `openssl rand -base64 32`), SEED_ADMIN_PASSWORD (12+ chars),
#    and AI_GATEWAY_API_KEY

# 4. Migrate and seed
cd server
bun run db:generate
bun run db:migrate
bun run db:seed             # admin user
bun run db:seed:ai-agent    # the "AI" agent that auto-resolved tickets are assigned to

# 5. Run (two terminals)
cd server && bun run dev
cd client && bun run dev
```

Open http://localhost:5173 and sign in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. The client proxies `/api` to the server.

`bun run db:seed:tickets` adds sample tickets for local development.

## Environment variables (server)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Session signing secret, 32+ characters (required) |
| `BETTER_AUTH_URL` | Public origin of the app (a path is ignored) |
| `TRUSTED_ORIGINS` | Comma-separated allowed origins for CORS and auth |
| `INBOUND_EMAIL_SECRET` | Shared secret for the inbound email webhook, 32+ characters (required) |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway key for all AI features |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Admin created by `db:seed` |
| `SENTRY_DSN` | Optional; error reporting is off when empty |
| `RATE_LIMIT_ENABLED` | Set to `false` to disable auth rate limiting (used by e2e) |

The client reads `VITE_SENTRY_DSN` at build time (optional).

## Receiving email

Point your email provider at `POST /api/webhooks/inbound-email` with the header `x-webhook-secret: <INBOUND_EMAIL_SECRET>` and a JSON body:

```json
{
  "from": "student@example.com",
  "fromName": "Student",
  "subject": "Refund question",
  "text": "Hi, I'd like a refund...",
  "messageId": "<optional-unique-id>"
}
```

## Tests

```bash
# Component tests (no database needed)
cd client && bun run test

# End-to-end (Playwright, uses the throwaway db-test container)
cd e2e && bun install && bun run db:up && bun run test
```

## Deployment (Railway)

The repo deploys as a single service: the root `Dockerfile` builds the client and the server serves it alongside the API. `railway.json` runs `prisma migrate deploy` before each deploy and health-checks `/api/health`.

1. Create a Railway project from this repo and add the PostgreSQL plugin.
2. Set the service variables: `DATABASE_URL` (`${{Postgres.DATABASE_URL}}`), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` and `TRUSTED_ORIGINS` (the public `https://` origin), `INBOUND_EMAIL_SECRET`, `AI_GATEWAY_API_KEY`, and optionally `SENTRY_DSN` / `VITE_SENTRY_DSN`.
3. After the first successful deploy, seed the admin and the AI agent once. The private `*.railway.internal` database host is not reachable from your machine, so either use the Postgres service's public TCP proxy URL, or run the seeds inside the service with `railway ssh`.

To try the production image locally:

```bash
docker build -t helpdesk .
docker run -p 3000:3000 --env-file server/.env \
  -e DATABASE_URL="postgresql://helpdesk:helpdesk@host.docker.internal:5432/helpdesk" \
  -e BETTER_AUTH_URL=http://localhost:3000 -e TRUSTED_ORIGINS=http://localhost:3000 helpdesk
```

(`localhost` inside the container is not your machine, hence the `host.docker.internal` override.)

## More documentation

- `project-scope.md`: requirements
- `implementation-plan.md`: phased task breakdown
- `CLAUDE.md`: architecture and conventions
