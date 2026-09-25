# Job Jet — web app (`apps/web`)

Next.js 16 (App Router) app that serves the landing page, the signed-in
dashboard (profile editor, resume upload, applications tracker), the public
`/privacy` and `/terms` pages, and every API route the Chrome extension calls.

See the [root README](../../README.md) for the whole project and
[`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) for design details.

## Run locally

```bash
# from the repo root
npm ci
cp apps/web/.env.example apps/web/.env.local   # fill in values (or `vercel env pull .env.local`)
npm run db:migrate --workspace=apps/web
npm run dev:web                                # http://localhost:3001
```

The dev server is pinned to **port 3001**; the extension's
`VITE_API_BASE_URL` and `BETTER_AUTH_URL` must point at it. A local Postgres
works too: a `localhost` `DATABASE_URL` switches the client to node-postgres.
Without `RESEND_API_KEY`, verification and password-reset links are printed
to the dev server console.

## Scripts

| Script | Description |
| --- | --- |
| `dev` | `next dev -p 3001` |
| `build` / `start` | Production build / server |
| `lint` | ESLint (`eslint-config-next`) |
| `typecheck` | `next typegen && tsc --noEmit` (route types must be generated first) |
| `test` | Vitest unit tests in `tests/` |
| `db:generate` | Generate a SQL migration from `src/db/schema.ts` into `drizzle/` |
| `db:migrate` | Apply migrations using `.env.local` |
| `db:migrate:env` | Apply migrations using `DATABASE_URL` from the environment (CI/production) |
| `db:baseline` | One-time: mark `0000_initial_schema` applied on a DB created with `db:push` |
| `db:push` / `db:studio` | Dev-only schema push / Drizzle Studio |
| `auth:migrate-clerk` | Optional, one-off: import a Clerk users export (`-- --file export.csv [--apply]`, dry run by default) |

## Environment

Every variable is documented in [`.env.example`](.env.example). Secrets are
read lazily at request time (`src/lib/env.ts`), so builds don't need them.
In production, `ALLOWED_EXTENSION_IDS` must list the Chrome Web Store
extension ID or the extension can't connect (no token, no bearer auth, no
CORS).

## API routes

All routes call `requireUser(req)` (`src/lib/auth/session.ts`): a Better Auth
session cookie from the web app, or an extension bearer token (never accepted
from a web origin, and bound to an allowlisted extension). No session → 401.
Errors are JSON `{ "error": string }`.

| Route | Methods | Notes |
| --- | --- | --- |
| `/api/profile` | GET, PUT | Canonical profile; body ≤ 200 KB, zod-validated |
| `/api/resume` | GET, POST | Upload PDF/DOCX (≤ 10 MB) → Blob + AI parse; 10 parses/hour/user |
| `/api/resume/tailor` | POST | JD (≤ 30k chars) → tailored PDF; 20/hour/user |
| `/api/resume/[id]/download` | GET | Streams a private resume file after an ownership check |
| `/api/autofill/map` | POST | LLM fallback field matching + shared cache; ≤ 150 fields; 60 LLM calls/hour/user |
| `/api/applications` | GET, POST | Tracker list / upsert by URL |
| `/api/applications/[id]` | PATCH, DELETE | Edit (zod-validated, resume ownership checked) / delete |
| `/api/auth/*` | GET, POST | Better Auth: sign-in/up, Google OAuth callback, sessions, password reset, email verification, `delete-user`, and `extension/token` (mints the extension's session) |

## Layout

```
src/app/            pages + API route handlers
src/components/     shared UI (header, footer, dashboard shell, legal page layout)
src/db/             Drizzle schema (incl. Better Auth tables) + lazy DB client
src/lib/auth/       Better Auth config, session helpers, origin policy, extension-token plugin
src/lib/            AI calls, email senders, validation, rate limiting, CORS, HTTP helpers
drizzle/            generated SQL migrations (commit these)
scripts/            db-baseline.mjs, migrate-clerk-users.mjs
tests/              Vitest tests (auth tests run against PGlite with the real migrations)
```
