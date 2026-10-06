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
- Server hardening: `helmet`, CORS limited to `TRUSTED_ORIGINS` (comma-separated, shared via `trustedOrigins` in `auth.ts`), generic 500 error handler, secure cookies in production
- `auth.ts` throws at startup if `BETTER_AUTH_SECRET` is under 32 chars; passwords must be 12+ chars (`MIN_PASSWORD_LENGTH`, duplicated in `prisma/seed.ts`)
- Rate limiting covers `/api/auth/*` only (Better Auth, in-memory, sign-in 5/min); disable with `RATE_LIMIT_ENABLED=false` (e2e does)
- Security review: use the `security-reviewer` subagent (`.claude/agents/security-reviewer.md`); still open: bind Postgres to `127.0.0.1` in `docker-compose.yml`, rate limit for non-auth routes

## Frontend conventions

- Import with the `@/` alias (maps to `client/src`)
- Use shadcn components from `@/components/ui` and Tailwind utilities; no custom CSS beyond `src/index.css` (Tailwind + shadcn theme variables)
- Add components with `bunx --bun shadcn@latest add <name>`

## E2E tests (Playwright)

- Live in `/e2e`; use the `e2e-test-writer` subagent (`.claude/agents/e2e-test-writer.md`) to write them. Setup and conventions are documented there

## Key Conventions

- Use Bun as the runtime and package manager (not npm/yarn)
- Use TypeScript throughout
- Use context7 MCP server to fetch up-to-date documentation for libraries
