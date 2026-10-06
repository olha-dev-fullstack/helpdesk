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

## Frontend conventions

- Import with the `@/` alias (maps to `client/src`)
- Use shadcn components from `@/components/ui` and Tailwind utilities; no custom CSS beyond `src/index.css` (Tailwind + shadcn theme variables)
- Add components with `bunx --bun shadcn@latest add <name>`

## E2E tests (Playwright)

- Lives in `/e2e` (own `package.json`); no tests written yet, put specs in `e2e/tests/`
- Uses a separate throwaway Postgres (`db-test` service in `docker-compose.yml`, port 5433, tmpfs) so dev data is never touched. Start it with `cd e2e && bun run db:up`, run with `bun run test`
- `e2e/env.ts` holds the test ports (server 3100, client 5273), DB URL and seeded admin (`admin@e2e.test`); `global-setup.ts` runs `migrate deploy` + seed and refuses non-`_test` databases
- `playwright.config.ts` starts its own server and Vite client (`API_PROXY_TARGET` points Vite's proxy at the test server), so dev servers can keep running

## Key Conventions

- Use Bun as the runtime and package manager (not npm/yarn)
- Use TypeScript throughout
- Use context7 MCP server to fetch up-to-date documentation for libraries
