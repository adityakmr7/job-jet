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
`VITE_CLERK_SYNC_HOST` must point at it.

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

## Environment

Every variable is documented in [`.env.example`](.env.example). Secrets are
read lazily at request time (`src/lib/env.ts`), so builds don't need them.
In production, `ALLOWED_EXTENSION_IDS` must list the Chrome Web Store
extension ID or the extension's API calls will be blocked by CORS.

## API routes

All routes require a Clerk session (cookie from the dashboard, or a Bearer
token from the extension). Errors are JSON `{ "error": string }`.

| Route | Methods | Notes |
| --- | --- | --- |
| `/api/profile` | GET, PUT | Canonical profile; body ≤ 200 KB, zod-validated |
| `/api/resume` | GET, POST | Upload PDF/DOCX (≤ 10 MB) → Blob + AI parse; 10 parses/hour/user |
| `/api/resume/tailor` | POST | JD (≤ 30k chars) → tailored PDF; 20/hour/user |
| `/api/resume/[id]/download` | GET | Streams a private resume file after an ownership check |
| `/api/autofill/map` | POST | LLM fallback field matching + shared cache; ≤ 150 fields; 60 LLM calls/hour/user |
| `/api/applications` | GET, POST | Tracker list / upsert by URL |
| `/api/applications/[id]` | PATCH, DELETE | Edit (zod-validated, resume ownership checked) / delete |

## Layout

```
src/app/            pages + API route handlers
src/components/     shared UI (header, footer, dashboard shell, legal page layout)
src/db/             Drizzle schema + lazy Neon client
src/lib/            AI calls, validation, rate limiting, CORS, HTTP helpers
drizzle/            generated SQL migrations (commit these)
scripts/            db-baseline.mjs
tests/              Vitest unit tests
```
