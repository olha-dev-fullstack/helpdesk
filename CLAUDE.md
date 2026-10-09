# Helpdesk - AI-Powered Ticket Management System

## Project Overview

A ticket management system that uses AI to classify, respond to, and route support tickets. See `project-scope.md` for full requirements and `implementation-plan.md` for phased task breakdown.

## Tech Stack

- **Frontend**: React + TypeScript + Vite (port 5173)
- **Backend**: Express + TypeScript + Bun (port 3000)
- **Database**: PostgreSQL with Prisma ORM
- **AI**: Claude API (Anthropic)
- **Auth**: Better Auth (email/password, database sessions)
- **UI**: Tailwind CSS v4 + shadcn/ui (`base-nova` preset, default theme)
- **Forms**: react-hook-form + zod

## Project Structure

```
/client   - React frontend (Vite)
/server   - Express backend
/core     - Code shared by both: zod schemas, enums/constants (source-only, imported as `@core`)
```

## Development

```bash
# Start PostgreSQL (docker-compose.yml in project root)
docker compose up -d

# Start server
cd server && bun run dev

# Start client
cd client && bun run dev
```

The client proxies `/api/*` requests to the server via Vite config.

## Shared code (core)

- Anything used by both client and server (zod schemas, ticket/user enums, limits like `MIN_PASSWORD_LENGTH`) lives in `core/src` and is imported as `@core` (tsconfig `paths` in client and server, plus a Vite alias; Vite `server.fs.allow` includes the parent dir)
- `core` has its own `package.json` (zod); run `bun install` in `core/` after cloning
- Server-only schemas (ticket list query, inbound email) and client-only ones (login) stay in their own app

## Server layout

Request flow: `routes` -> `controllers` -> `services` -> `repositories` -> Prisma. Each layer only calls the one below it.

- `server/src/routes`: only wires paths to controller functions, no logic; one file per resource (`tickets`, `replies`, `polish`, `summary`, `users`, `inbound-email`). Nested resources mount their router with `Router({ mergeParams: true })`
- `server/src/controllers`: the HTTP layer. Parse input (`parseOrReject`), run all checks (404s, role, uniqueness, webhook secret), call repositories/services, send the response. Read ids with `String(req.params.id)`
- `server/src/services`: business logic with no `req`/`res` (AI calls, password hashing, list query building). Only add one when there is logic beyond a repository call
- `server/src/repositories`: the only code allowed to import `prisma`. They own `select` objects and map Prisma error codes (`isPrismaError`) to `null`/string results (`"not-found"`, `"conflict"`) that the controller turns into HTTP statuses. Checks that must be atomic with the write (e.g. "last admin" in `deleteUser`) stay inside the repository transaction
- `server/src/schemas`: server-only zod schemas (ticket list query, inbound email) and their limits; schemas shared with the client stay in `@core`
- `server/src/lib` is for infrastructure only (`prisma`, `auth`, `validation`, `prisma-errors`); `middlewares` for Express guards
- New endpoint checklist: schema -> repository function -> (service) -> controller function -> route line; new public routes still go above `requireAuth` in `index.ts`
- Files are named by resource without a layer suffix (`controllers/tickets.ts`, `repositories/ticket.ts`) and imported as namespaces (`import * as ticketRepository from "../repositories/ticket"`)

## Database (server)

- Copy `server/.env.example` to `server/.env` (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` (min 12 chars))
- Prisma 7 with the `pg` driver adapter; client is generated to `server/src/generated/prisma` (gitignored) and instantiated in `server/src/lib/prisma.ts`
- Scripts (run in `server/`): `bun run db:generate`, `db:migrate`, `db:seed` (creates the admin user), `db:studio`
- Keep the `prisma` CLI pinned to the same version as `@prisma/client` (`bun add -d prisma` can pull a mismatched release candidate)
- `prisma.config.ts` loads `.env` via `dotenv` because Bun does not load it when Prisma reads the config
- `migrate dev` refuses to run non-interactively when a migration changes a column type; write the SQL by hand and apply with `prisma migrate deploy`

## Auth

- Better Auth config: `server/src/lib/auth.ts`, mounted at `/api/auth/*splat` in `server/src/index.ts` before `express.json()`
- Sessions are stored in the database (no `secondaryStorage` or `cookieCache`)
- `User.role` is a Prisma enum `Role` (`admin` | `agent`), default `agent`, not settable from client input
- `auth generate` overwrites `prisma/schema.prisma` (including the `Role` enum); re-apply it after regenerating
- Client: `client/src/lib/auth-client.ts` exports `authClient` and a bare `useSession` hook; use `useSession` for session reads
- Client `authClient` uses `inferAdditionalFields` so `session.user.role` is typed; keep it in sync with `additionalFields` in `auth.ts`
- Routing (`client/src/App.tsx`): `ProtectedRoute` (requires session, renders NavBar) wraps `AdminRoute` (requires `role === "admin"`, else redirects to `/`); admin-only pages (e.g. `/users`) go inside `AdminRoute`
- Client-side guards are UX only; admin API endpoints must also check the role on the server
- Server guards (`server/src/index.ts`): public routes (`/api/auth/*`, `/api/health`) are registered first, then `app.use("/api", requireAuth)`; admin routers mount after `app.use("/api/users", requireAdmin)`. New public routes must go above the `requireAuth` line
- Server validation uses zod: define a schema per route (`server/src/schemas`, or `@core` if the client shares it) and call `parseOrReject` (`server/src/lib/validation.ts`), which sends a 400 with the first issue message
- Express 5: async route handlers need no try/catch; rejections reach the generic error handler
- Server hardening: `helmet`, CORS limited to `TRUSTED_ORIGINS` (comma-separated, shared via `trustedOrigins` in `auth.ts`), generic 500 error handler, secure cookies in production
- `auth.ts` throws at startup if `BETTER_AUTH_SECRET` is under 32 chars; passwords must be 12+ chars (`MIN_PASSWORD_LENGTH` from `@core`)
- Rate limiting covers `/api/auth/*` only (Better Auth, in-memory, sign-in 5/min); disable with `RATE_LIMIT_ENABLED=false` (e2e does)
- Security review: use the `security-reviewer` subagent (`.claude/agents/security-reviewer.md`); still open: rate limit for non-auth routes, max lengths on user input (zod + `express.json` limit), revoke sessions on email change

## AI features

- Server AI calls use the Vercel AI SDK `generateText` with a plain model string (`openai/gpt-5-nano`), routed through the AI Gateway; needs `AI_GATEWAY_API_KEY` in `server/.env`
- Reply polish: `POST /api/tickets/:id/replies/polish` (`server/src/controllers/polish.ts`, body validated by `polishSchema` in `@core`) rewrites the draft; client side is the Polish button in `ReplyForm` via `useReplyForm`
- Ticket summary: `POST /api/tickets/:id/summary` (`server/src/controllers/summary.ts`) summarizes the original message + reply history; nothing is stored, so each call regenerates. Client: `TicketSummary` (Summarize button with sparkles icon, below the Message card) + `useTicketSummary`
- Ticket classification: `services/classify.ts` uses a pg-boss queue (`lib/queue.ts`, tables in the `pgboss` schema of the app DB). The inbound email controller calls `enqueueClassifyTicket(ticketId)`; the worker (`startClassifyWorker`, started in `index.ts`) loads the ticket, picks a `TICKET_CATEGORIES` value with `Output.choice`, and only fills a still-empty category. Jobs retry 3 times with backoff; enqueue failures are logged, never thrown
- Auto-resolve: `services/resolve.ts` (`resolve-ticket` pg-boss queue, enqueued next to classification) answers new tickets from `server/knowledge-base.md`. Status lifecycle `new` -> `processing` -> `resolved` (AI reply stored with `authorId: null`) or `open` (not covered, escalation rule, or any error; no pg-boss retries so it never replies twice). `new`/`processing` are system-owned: `ticketUpdateSchema` only accepts `EDITABLE_TICKET_STATUSES`
- AI agent: `bun run db:seed:ai-agent` creates the `AI` agent (`AI_AGENT_EMAIL` in `@core`, no credential account, so it can't sign in). The resolve worker assigns a ticket to it when claiming (`new` -> `processing`) and unassigns it when handing the ticket to humans (only if still assigned to the AI). Resolved tickets stay assigned to AI. It's excluded from `listAssignees`; without the seed, tickets just stay unassigned
- Dashboard: `GET /api/stats` (`controllers/stats.ts` -> `repositories/stats.ts` -> the `dashboard_stats(chart_days)` Postgres function, created by a hand-written migration, so changing the stats means a new migration that `CREATE OR REPLACE`s it) feeds `features/dashboard` on `HomePage` (total, open, resolved by AI count/%, average resolution time, plus `ticketsPerDay`: zero-filled UTC counts for the last 30 days, shown as a recharts bar chart via shadcn `chart`). "Resolved by AI" = resolved/closed ticket with an author-less agent reply; resolution time uses `Ticket.resolvedAt`, stamped on first resolve/close and cleared when reopened (`updateTicket`, `resolveProcessingTicket`)
- Prompts treat ticket/reply text as data, not instructions; new AI routes should do the same

## Error logging (Sentry)

- Server: `server/src/instrument.ts` (`@sentry/bun`, imported first in `index.ts`) reads `SENTRY_DSN`; `Sentry.setupExpressErrorHandler(app)` sits right before `errorHandler` and reports 5xx only. Errors that are caught and logged (health check, pg-boss, classify/resolve workers and enqueue) call `Sentry.captureException` next to `console.error`; do the same for new swallowed errors
- Client: `client/src/lib/sentry.ts` (`@sentry/react`) reads `VITE_SENTRY_DSN`, enabled in production builds only; React 19 error hooks are wired in `main.tsx`
- Without a DSN the SDKs are disabled, so dev and tests need no setup

## Frontend conventions

- Import with the `@/` alias (maps to `client/src`)
- Use shadcn components from `@/components/ui` and Tailwind utilities; no custom CSS beyond `src/index.css` (Tailwind + shadcn theme variables)
- Add components with `bunx --bun shadcn@latest add <name>`
- Feature folders: `client/src/features/<feature>/{components,hooks,types.ts,constants.ts,api.ts}`; `pages/` are thin route entries that compose a feature's hook and components (see `features/tickets`, `features/users`)
- One component per file; data fetching, mutations and state logic live in custom hooks (`hooks/useXxx.ts`), not in components; shared types/enums go in `types.ts`, constants (query keys, option lists, labels) in `constants.ts`; cross-feature helpers go in `src/hooks` and `src/lib`
- Review any component over 300 lines and split it (hook + sub-components)
- Data fetching: use axios for HTTP requests and TanStack Query (`@tanstack/react-query`) for server state (`useQuery`/`useMutation`); no raw `fetch` + `useEffect`. `QueryClientProvider` is set up in `client/src/main.tsx`
- Use `Skeleton` (`@/components/ui/skeleton`) for loading states, not "Loading..." text
- Admin user list: `GET /api/users` (`server/src/controllers/users.ts`) feeds `client/src/pages/UsersPage.tsx`; `POST /api/users` (admin-only, always creates role `agent`, writes user + credential account via Prisma like the seed since `disableSignUp` blocks Better Auth sign-up) feeds `UserFormDialog` (create + edit); `PATCH /api/users/:id` (blank password = unchanged; a password change deletes that user's sessions) and `DELETE /api/users/:id` (rejects deleting yourself; sessions/accounts cascade) feed the row actions and `DeleteUserDialog`

## Component tests (Vitest)

- Vitest + jsdom + React Testing Library; config in the `test` block of `vite.config.ts`, setup in `client/src/test/setup.ts` (jest-dom matchers, auto-cleanup). No database or server needed
- Run from `client/`:
  - `bun run test` runs all tests once (`vitest run`)
  - `bun run test src/pages/UsersPage.test.tsx` runs one file
  - `bun run test -t "empty"` runs tests whose name matches
  - `bunx vitest` starts watch mode
  - `bunx tsc --noEmit -p tsconfig.app.json` typechecks tests too
- Run component tests after changing anything under `client/src`; e2e (below) is a separate suite
- Put tests next to the component (`Foo.test.tsx`); mock axios with `vi.mock("axios")` and wrap in a `QueryClientProvider` with `retry: false`

## E2E tests (Playwright)

- Live in `/e2e`; use the `e2e-test-writer` subagent (`.claude/agents/e2e-test-writer.md`) to write them. Setup and conventions are documented there

## Key Conventions

- Use Bun as the runtime and package manager (not npm/yarn)
- Use TypeScript throughout
- Use context7 MCP server to fetch up-to-date documentation for libraries
