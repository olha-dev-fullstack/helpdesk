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
- Server validation uses zod: define a schema per route and call `parseOrReject` (`server/src/lib/validation.ts`), which sends a 400 with the first issue message
- Express 5: async route handlers need no try/catch; rejections reach the generic error handler
- Server hardening: `helmet`, CORS limited to `TRUSTED_ORIGINS` (comma-separated, shared via `trustedOrigins` in `auth.ts`), generic 500 error handler, secure cookies in production
- `auth.ts` throws at startup if `BETTER_AUTH_SECRET` is under 32 chars; passwords must be 12+ chars (`MIN_PASSWORD_LENGTH` from `@core`)
- Rate limiting covers `/api/auth/*` only (Better Auth, in-memory, sign-in 5/min); disable with `RATE_LIMIT_ENABLED=false` (e2e does)
- Security review: use the `security-reviewer` subagent (`.claude/agents/security-reviewer.md`); still open: rate limit for non-auth routes, max lengths on user input (zod + `express.json` limit), revoke sessions on email change

## Frontend conventions

- Import with the `@/` alias (maps to `client/src`)
- Use shadcn components from `@/components/ui` and Tailwind utilities; no custom CSS beyond `src/index.css` (Tailwind + shadcn theme variables)
- Add components with `bunx --bun shadcn@latest add <name>`
- Feature folders: `client/src/features/<feature>/{components,hooks,types.ts,constants.ts,api.ts}`; `pages/` are thin route entries that compose a feature's hook and components (see `features/tickets`, `features/users`)
- One component per file; data fetching, mutations and state logic live in custom hooks (`hooks/useXxx.ts`), not in components; shared types/enums go in `types.ts`, constants (query keys, option lists, labels) in `constants.ts`; cross-feature helpers go in `src/hooks` and `src/lib`
- Review any component over 300 lines and split it (hook + sub-components)
- Data fetching: use axios for HTTP requests and TanStack Query (`@tanstack/react-query`) for server state (`useQuery`/`useMutation`); no raw `fetch` + `useEffect`. `QueryClientProvider` is set up in `client/src/main.tsx`
- Use `Skeleton` (`@/components/ui/skeleton`) for loading states, not "Loading..." text
- Admin user list: `GET /api/users` (`server/src/routes/users.ts`) feeds `client/src/pages/UsersPage.tsx`; `POST /api/users` (admin-only, always creates role `agent`, writes user + credential account via Prisma like the seed since `disableSignUp` blocks Better Auth sign-up) feeds `UserFormDialog` (create + edit); `PATCH /api/users/:id` (blank password = unchanged; a password change deletes that user's sessions) and `DELETE /api/users/:id` (rejects deleting yourself; sessions/accounts cascade) feed the row actions and `DeleteUserDialog`

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
