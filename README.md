# Job Jet

A Chrome extension that recognizes job application pages on (in principle)
any site, and helps fill them out: autofill from a saved profile, or generate
a resume tailored to the specific job description via AI.

Full system design, data model, and the reasoning behind what's built (and
deliberately not built) is in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
Release notes are in [`CHANGELOG.md`](CHANGELOG.md).

## Structure

```
apps/
  web/         Next.js app — auth, dashboard, legal pages, all backend API routes
  extension/   Chrome MV3 extension (Vite + CRXJS + React), side panel UI
packages/
  shared/      Shared TS types/zod schemas: Profile, Resume, Application, FieldMapping
scripts/       Repo-level tooling (extension release zip)
```

## Stack

- **Extension**: Manifest V3, Vite + `@crxjs/vite-plugin`, React side panel.
- **Backend**: Next.js 16 (App Router) API routes on Vercel.
- **Auth**: [Better Auth](https://www.better-auth.com) (self-hosted library;
  users and sessions live in our own Neon Postgres via Drizzle). Email +
  password and Google sign-in on the web; the extension connects with a
  dedicated bearer token. See [Authentication](#authentication).
- **Database**: Neon Postgres via Drizzle ORM, with SQL migrations in
  `apps/web/drizzle`.
- **File storage**: Vercel Blob, private store (uploaded resumes + generated
  tailored PDFs).
- **AI**: AI SDK with the Google provider (`gemini-2.5-flash`). The provider is
  isolated in `apps/web/src/lib/ai.ts` (`getModel()`), so swapping models or
  providers is a one-file change.

## Getting started

Requirements: **Node.js 22+** (see `.nvmrc`; `nvm use`) and npm.

```bash
npm ci

# 1. Web app / API — http://localhost:3001 (pinned; 3000 is often taken)
cp apps/web/.env.example apps/web/.env.local   # fill in values (or `vercel env pull`)
npm run db:migrate --workspace=apps/web        # create/upgrade tables
npm run dev:web

# 2. Extension
cp apps/extension/.env.example apps/extension/.env.development   # dev section
npm run dev:extension
```

Then load `apps/extension/dist` as an unpacked extension in
`chrome://extensions` (Developer mode on). After a rebuild, click the
extension's reload icon — Chrome doesn't pick up on-disk changes to an
already-loaded unpacked extension on its own.

Keep `VITE_API_BASE_URL` matched to the port `npm run dev:web` binds to. In
development, with `ALLOWED_EXTENSION_IDS` empty, any unpacked extension can
connect; open the side panel, click **Connect to Job Jet** and approve on the
web page that opens.

**Local Postgres instead of Neon (optional):** when `DATABASE_URL` points at
`localhost`/`127.0.0.1`, the app uses node-postgres instead of Neon's HTTP
driver, so a plain local Postgres works for development
(`DATABASE_URL=postgres://user:pass@localhost:5432/jobjet`).

## Authentication

Accounts are stored in our own database by
[Better Auth](https://www.better-auth.com) (`better-auth` npm package, Drizzle
adapter). No third-party auth service is involved; Google sign-in uses plain
Google OAuth.

- **Web**: email + password (10–128 characters) and **Continue with Google**
  (shown only when `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set). Sessions
  are httpOnly, SameSite=Lax cookies (`Secure` + `__Secure-` prefix in
  production), valid 30 days, refreshed daily. Pages: `/sign-in`, `/sign-up`,
  `/forgot-password`, `/reset-password`, `/verify-email`,
  `/dashboard/account` (change password, connected devices, delete account).
- **Server helpers** (`apps/web/src/lib/auth/session.ts`): `requireUser(req)`
  in every API route (401 JSON otherwise; ownership checks and rate limits are
  unchanged and still scope every query to `user.id`), `requirePageUser()` /
  `getSession()` in server components. `src/proxy.ts` only does a fast
  cookie-presence redirect; the real session check happens server-side.
- **Rate limiting**: Better Auth's limiter, stored in Postgres
  (`auth_rate_limit`), per IP: sign-in 10/minute, sign-up 5 per 10 minutes,
  password-reset and verification emails 5 per 10 minutes, change-password 10
  and delete-account 5 per 10 minutes; 100/minute for everything else.
- **Extension**: see [Extension auth](#extension-auth) below.
- **Account deletion** (`/dashboard/account`) requires the password (or a
  recent sign-in for Google-only accounts), deletes the user's resume files
  from Vercel Blob first, then the user row — profiles, resumes, applications,
  sessions and linked accounts cascade.

### Email verification tradeoff

Email sending is pluggable (`apps/web/src/lib/email.ts`):

- **`RESEND_API_KEY` set** → emails go through Resend, and email verification
  is **required** before password sign-in (Google accounts are verified by
  Google).
- **Not set** → a console sender prints verification/reset links to the server
  log **in development only**; in production it logs a warning and sends
  nothing. Verification is **not enforced**, because users couldn't receive
  the email and would be locked out. The tradeoff: without an email provider
  anyone can sign up with an address they don't own (they can't take over an
  existing account — duplicate emails are rejected — but the address isn't
  proven), and "forgot password" can't work in production. Configure Resend
  before launch.

### Extension auth

1. The side panel's **Connect to Job Jet** opens
   `https://<web>/extension-connect?ext=<extension id>&state=<one-time nonce>`
   in a tab (the nonce is kept in `chrome.storage.session`, single use, 10
   minutes).
2. The user signs in on the web if needed and clicks **Connect extension**.
   The page calls `POST /api/auth/extension/token` with its cookie session
   (Better Auth's origin check applies); the server refuses extension IDs not
   in `ALLOWED_EXTENSION_IDS` and mints a **new, separate session** labelled
   `Job Jet extension (<id>)`, replacing that install's previous one.
3. The page hands the signed token to that extension ID only, with
   `chrome.runtime.sendMessage(extId, …)`. The manifest's
   `externally_connectable` only lets the production web origin (plus
   `localhost` in dev builds) message the extension, and the background worker
   also checks the exact sender origin, the `/extension-connect` path, the
   message schema and the nonce.
4. The extension stores the token in `chrome.storage.local` and sends it as
   `Authorization: Bearer <token>`; `credentials: "omit"` keeps it
   bearer-only. On a 401 it clears the token and shows **Reconnect**.
   **Sign out** revokes the session server-side and clears it locally; the web
   **Account settings → Where you're signed in** can disconnect it too.

The server accepts a bearer token only if (a) the request doesn't come from a
web origin (browsers always send Origin cross-origin, and pages can't forge
`chrome-extension://`), and (b) the session was minted for an extension ID
that is still allowlisted — and, when an Origin is present, for that exact
extension. A web session cookie can't be replayed as a bearer token, and a
bearer token can't mint more tokens. Tokens are HMAC-signed with
`BETTER_AUTH_SECRET`, so a database leak alone doesn't yield usable tokens.
See [`SECURITY.md`](SECURITY.md) for the reasoning.

### Google sign-in setup

1. [Google Cloud Console](https://console.cloud.google.com/) → create or pick
   a project.
2. **APIs & Services → OAuth consent screen** (Google Auth Platform →
   Branding/Audience): app name "Job Jet", support email, app logo optional,
   **authorized domain** = your production domain, developer contact email,
   privacy policy `https://<domain>/privacy`, terms `https://<domain>/terms`.
   Scopes: only `openid`, `.../auth/userinfo.email`,
   `.../auth/userinfo.profile` (non-sensitive, no verification review
   needed). User type **External**; while in *Testing*, add test users, then
   **Publish app** for launch.
3. **Credentials → Create credentials → OAuth client ID → Web application**:
   - Authorized JavaScript origins: `https://<domain>` and
     `http://localhost:3001`.
   - Authorized redirect URIs: `https://<domain>/api/auth/callback/google` and
     `http://localhost:3001/api/auth/callback/google` (add preview domains
     only if you really sign in on them).
4. Copy the client ID/secret into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
   (Vercel env, and `.env.local` for development). Use separate clients for
   production and development if you prefer.

Account linking is enabled for Google: signing in with Google using the same
email as an existing email+password account links the two (Google has verified
the address), which is also how migrated Clerk users regain access.

### Migrating existing Clerk users (optional)

The app isn't launched, so this is optional. Migration `0002_better_auth`
already keeps existing rows: every old `users` row becomes a Better Auth
`user` with the **same id** (the Clerk `user_…` id), so profiles, resumes and
applications stay attached. Those users have no password; they either sign in
with Google (linked by email) or use **Forgot password**.

To bring over names/verification status (or users who never touched the
database) from a Clerk export (Dashboard → Users → Export, CSV or JSON):

```bash
cd apps/web
npm run db:migrate                                              # first
npm run auth:migrate-clerk -- --file ./clerk-users.csv          # dry run (default): prints the plan
npm run auth:migrate-clerk -- --file ./clerk-users.csv --apply  # writes, one transaction per user
```

For each Clerk user (matched by primary email) it creates the Better Auth
user with the Clerk name and `emailVerified`, moves `profiles`/`resumes`/
`applications` from the Clerk id to a fresh Better Auth id, or merges them
into an existing Better Auth account with the same email. Re-running is safe.
It never imports password hashes (Clerk's bcrypt digests aren't portable). Take a database backup (Neon
branch) first.

## Environment variables

### Web (`apps/web/.env.example`)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API key (resume parsing, tailoring, autofill matching) |
| `BETTER_AUTH_SECRET` | Signs session cookies/tokens. `openssl rand -base64 32`; different per environment |
| `BETTER_AUTH_URL` | Public origin of the app (`https://<domain>`, `http://localhost:3001` locally) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional: Google sign-in (see [setup](#google-sign-in-setup)) |
| `RESEND_API_KEY` / `EMAIL_FROM` | Optional: verification + password-reset emails via Resend; also turns on required email verification |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob (private store) |
| `ALLOWED_EXTENSION_IDS` | Comma-separated Chrome extension IDs that may connect (get tokens), use bearer auth and CORS. Empty = any extension in dev, **none in production** |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Contact address shown on `/privacy` and `/terms` |

Secrets are read lazily at request time, so `next build` works without them.

### Extension (`apps/extension/.env.example`)

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Web app origin (no path): API base URL, the `/extension-connect` page, and the only origin allowed to message the extension; its host is excluded from job detection |
| `JOBJET_ALLOW_DEV_CONFIG` | Optional, not bundled: `true` downgrades production checks to warnings |

The build **fails** if a required value is missing or malformed. Production
builds (`npm run build`, mode `production`, reads `.env.production`) also fail
if the backend is localhost or not https. Use
`npm run build:dev --workspace=apps/extension` (reads `.env.development`) for
a local unpacked build.

## Scripts

Run from the repo root:

| Command | What it does |
| --- | --- |
| `npm run dev:web` / `npm run dev:extension` | Dev servers |
| `npm run lint` | ESLint in every workspace |
| `npm run typecheck` | `tsc --noEmit` everywhere (`next typegen` first for web) |
| `npm test` | Vitest unit tests in every workspace |
| `npm run build:web` / `npm run build:extension` | Production builds |
| `npm run release:extension` | Production extension build + Chrome Web Store zip in `release/` |
| `npm run format` / `npm run format:check` | Prettier (not enforced in CI yet) |
| `npm run test:fixtures` | Serve the detection fixture pages on :4000 |

Database scripts (`--workspace=apps/web`): `db:generate`, `db:migrate`,
`db:migrate:env`, `db:baseline`, `db:studio`, and `db:push` (dev only).

## Testing

`npm test` runs Vitest in each workspace:

- `apps/extension/tests` (jsdom) — job-page detection against the checked-in
  fixture pages, own-app exclusion, heuristic autofill mapping, the
  Greenhouse/Lever/Ashby adapters against field data captured from live
  postings, field collection (labels, honeypots, shadow DOM), and build-env
  validation.
- `apps/web/tests` — CORS, request validation and size limits, rate limiting,
  error handling, field-path resolution, the AI-output merge logic, and auth:
  real Better Auth + the real API routes against an in-process Postgres
  ([PGlite](https://pglite.dev)) with the real migrations — 401s, cookie vs
  bearer rules, ownership (no IDOR), sign-out revocation, account deletion,
  the `0002` migration and the Clerk import script (the AI SDK and Blob are
  mocked; no network or external database needed).
- `packages/shared/tests` — zod schemas and field signatures.

CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests and both builds
on every push and pull request to `main`.

### Manual testing against fixture pages

Real ATS sites are slow and inconsistent to test against repeatedly, so
`apps/extension/test-fixtures/` has local pages exercising the detection
heuristic and autofill directly:

```bash
npm run test:fixtures   # serves http://localhost:4000
```

- `/careers/senior-frontend-engineer/apply/` — a single-step job
  application form (positive case) — the floating button should appear,
  and Autofill should fill most text/select fields from your saved profile.
- `/careers/product-manager/apply/` — a 5-step wizard. Fields only exist in
  the DOM for the currently active step (not just CSS-hidden), and the URL
  hash changes per step — the harder, more realistic case, closer to how
  real SPA-driven ATS wizards behave. Re-open the side panel (or click
  Autofill again) after each "Next" to fill that step's fields.
- `/about/` — a plain content page (negative control) — the button should
  not appear here.

## Database and migrations

The schema lives in `apps/web/src/db/schema.ts`; SQL migrations are generated
into `apps/web/drizzle/`.

- Change the schema, then `npm run db:generate --workspace=apps/web` and
  commit the new migration.
- Apply migrations with `npm run db:migrate --workspace=apps/web` (uses
  `.env.local`) or `DATABASE_URL=... npm run db:migrate:env --workspace=apps/web`.
- **Production uses `db:migrate`, not `db:push`.** `db:push` is only for
  throwaway local databases.

**Existing database created with `db:push` (one-time):** it already has the
tables from `0000_initial_schema`, so mark that migration as applied instead
of running it, then migrate:

```bash
cd apps/web
DATABASE_URL=... node scripts/db-baseline.mjs   # or: npm run db:baseline (uses .env.local)
DATABASE_URL=... npm run db:migrate:env         # applies 0001_add_rate_limits and later
```

`db-baseline.mjs` refuses to run on an empty database or one that already
has migration history.

## Deployment

**Web (Vercel):** the Vercel project's Root Directory should be `apps/web`. Set every variable from
`apps/web/.env.example` in the Vercel project (production values: `pk_live_`/
a fresh `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=https://<domain>`, Google OAuth
credentials, `RESEND_API_KEY`/`EMAIL_FROM`, `ALLOWED_EXTENSION_IDS` with the
Chrome Web Store extension ID, `NEXT_PUBLIC_CONTACT_EMAIL`). Run migrations against the
production database before (or right after) deploying a release that
includes a new migration.

**Extension (Chrome Web Store):** once the production domain exists, run this
from the repo root:

```bash
cat > apps/extension/.env.production <<'ENV'
VITE_API_BASE_URL=https://<your-domain>          # deployed web app origin, no trailing slash
ENV
npm ci && npm run release:extension
# -> release/job-jet-extension-v<version>.zip  (git-ignored; upload this file)
```

The build refuses `http://` hosts and localhost in production
mode. Store listing text, permission justifications and images are in
[`store-assets/`](store-assets/LISTING.md). The listing also needs the public
privacy policy URL (`https://<your-domain>/privacy`). After the first upload,
add the store extension ID to `ALLOWED_EXTENSION_IDS` (web env) — until then
the published extension can't connect.

## Releasing

1. Bump `version` in `apps/extension/package.json` (the manifest version comes
   from it) and keep `apps/web`, `packages/shared` and the root in sync.
2. Move `[Unreleased]` entries in `CHANGELOG.md` under the new version.
3. Open a PR; merge when CI is green.
4. Tag the merge commit (`git tag v<version> && git push origin v<version>`) and
   create a GitHub release from the changelog section.
5. Run migrations on production, deploy the web app, then
   `npm run release:extension` and upload the zip to the Chrome Web Store.

## Security notes

- AI endpoints are rate-limited per user (Postgres-backed; see
  `apps/web/src/lib/rate-limit.ts`) and all JSON bodies are size-capped and
  zod-validated (`apps/web/src/lib/validation.ts`).
- The API only reflects CORS for extension IDs in `ALLOWED_EXTENSION_IDS`;
  every route still requires a session (web cookie, or an extension bearer
  token bound to an allowlisted extension).
- The AI never produces values typed into forms: autofill's LLM tier only
  picks a key from an allow-list, and tailoring can only reword existing
  content — both enforced in code.
- Security headers (CSP, frame-ancestors, HSTS, …) come from
  `apps/web/src/lib/security-headers.ts`. See [`SECURITY.md`](SECURITY.md) for
  the threat model, permission justifications and how to report issues.

## Design

The visual identity, tokens, components and accessibility rules are documented
in [`DESIGN.md`](DESIGN.md).

## How detection works

`apps/extension/src/lib/detect.ts` — a fast-path hostname allowlist for known
ATSs (Greenhouse, Lever, Workday, Ashby, iCIMS, SmartRecruiters, LinkedIn,
etc.) OR'd with a generic scored heuristic (URL/title keywords, page-text
keywords like "cover letter" / "work authorization", form-field name/label
keywords, presence of a file upload, input count) so bespoke company career
pages and unlisted ATSs still get picked up. Runs on `document_idle` and
re-runs on SPA route changes via a `MutationObserver`, since job boards are
almost all client-side routed.

On a positive detection, a floating launcher is injected into a closed shadow
root (host-page-CSS-proof, and unreachable by page scripts) in the bottom-right
corner; the user can hide it for the page. Clicking it opens the
`chrome.sidePanel`, which shows what was detected on the page, an "Autofill"
action, a "Tailor my resume to this job" action (auto-extracts the JD text
from the page), and a local skill-match summary.

## Autofill engine

Layered matching, cheapest first — see `docs/ARCHITECTURE.md` for the full
writeup, including what got found by inspecting two real live job postings:
1. **Heuristic (done)** — `apps/extension/src/lib/autofill-map.ts` matches
   detected fields against the user's saved profile purely by name/id/label
   keyword, entirely client-side. Fetches the profile from `/api/profile`
   cross-origin (the extension's session token as a Bearer header —
   see `src/lib/api.ts` and the backend's `src/lib/cors.ts`). Deliberately
   never fills voluntary EEO self-identification fields (gender, ethnicity,
   veteran/disability status, pronouns) — those stay opt-in and manual.
2. **Known-site adapter (done for Greenhouse, Lever, Ashby)** —
   `apps/extension/src/lib/adapters/` targets each platform's stable field
   id/name directly rather than guessing from label text. Verified against
   real captured field data from live postings on all three platforms
   (`npm run verify:adapters --workspace=apps/extension`). Workday has no
   adapter yet — its stable fields are behind an account-creation step not
   verified live; see `docs/ARCHITECTURE.md`.
3. **LLM fallback** (done) — `apps/web/src/app/api/autofill/map`. Fields
   tiers 1–2 miss get matched against a closed set of known profile
   attributes (never a raw value — see `apps/web/src/lib/field-paths.ts`),
   cached per-domain in the `field_mappings` table so repeat visits to the
   same ATS don't re-hit the LLM.

Known limitation: browsers restrict script-set `input[type=file].files` for
security, so resume/file fields are never auto-filled — the side panel
message says so explicitly. A `DataTransfer` workaround exists for some
sites but is not implemented yet.

## Roadmap / history

- [x] Repo scaffold: monorepo, shared types, extension detection heuristic +
      floating button + side panel shell, Next.js app.
- [x] Backend provisioned on Vercel: Clerk (auth), Neon (`DATABASE_URL`,
      schema pushed via Drizzle — `users`/`profiles`/`resumes`/`applications`/
      `field_mappings`), Vercel Blob (private store, resume files). Sign-in/
      sign-up pages and `/dashboard` verified working end-to-end.
- [x] Profile CRUD: `GET`/`PUT /api/profile` (lazy user upsert, zod-validated),
      full dashboard editor (basics, links, work authorization, experience
      with bullets, education, skills). Verified end-to-end in a real
      browser: sign-up → dashboard → edit → save → reload → persisted.
- [x] Resume upload → AI parse into structured `Profile`/`Resume` JSON:
      `POST /api/resume` extracts text (`pdf-parse`/`mammoth`), stores the
      original in Blob, structures it via Gemini (`generateObject`,
      `src/lib/resume-parse.ts`) into the shared `ResumeContent` shape.
      Dashboard lets you upload and offers to prefill the profile editor
      from the result. **Verified end-to-end with a real Gemini key and a
      real PDF** — every field (name, contact info, both links, both jobs
      with all bullets, education) came back correct. Two real bugs found
      and fixed along the way:
      - `pdf-parse` (via `pdfjs-dist`) broke under Next's server bundling
        ("Setting up fake worker failed") — fixed via `serverExternalPackages`
        in `next.config.ts`.
      - The model choice mattered a lot: `gemini-flash-latest` was
        overloaded (503), `gemini-3.6-flash` worked but took ~29s and
        leaked stray internal self-check narration into the `summary`
        field ("Cheating check. Accent check..."). Switched to
        `gemini-2.5-flash` — ~1s, clean output. See `src/lib/ai.ts`.
- [x] Extension ↔ backend auth wiring: `@clerk/chrome-extension`'s
      `ClerkProvider` in the side panel, `syncHost` pointed at the web app
      with `__experimental_syncHostListener` (live session sync instead of
      requiring the panel to be closed/reopened — a known limitation of the
      SDK without that flag), manifest updated with the `cookies` permission
      it needs. Extension ID registered in Clerk's `allowed_origins` via
      the Backend API. **Fully verified live**: autofill ran against a
      real signed-in profile (not test data) via the actual side panel —
      correct fields filled, EEO/file/no-data-source fields correctly
      skipped, confirmed against the profile's real (unset) data via the
      API rather than assumed.
      *(Superseded in 0.3.0: Clerk was replaced by Better Auth and the
      extension connects via `/extension-connect` — see
      [Authentication](#authentication).)*
- [x] Auto-continue for multi-step forms, and a full application tracker
      (auto-populated by the extension, managed from the dashboard) — see
      `docs/ARCHITECTURE.md`.
- [x] Local test fixtures for the detection heuristic (see below): a
      single-step form, a 5-step wizard (fields only exist in the DOM for
      the active step, URL hash changes per step — the harder/more
      realistic SPA-wizard case), and a negative control. All three
      verified working in a real browser.
- [x] Autofill engine v1 (heuristic tier) — see above. Code complete,
      type-checks, builds; **not yet live-verified** (Chrome caches a
      loaded unpacked extension — needs a manual reload after each
      rebuild, which can't be done from here; see "Getting started").
- [x] Original logo + brand identity (`apps/web/public/logo-mark.svg`,
      procedurally-generated matching extension icons at every size,
      Next.js app-icon/apple-icon conventions). Not derived from any other
      product's actual mark.
- [x] Original landing page (`apps/web/src/app/page.tsx`) — hero, feature
      grid, how-it-works, CTA, using Job Jet's own copy and design.
      **Scope note**: built with a comparable feature set to the "AI job
      copilot" product category, not as a copy of any specific competitor's
      branding, copy, or visual design — that would be a trademark/
      copyright problem regardless of who's asking. Verified rendering
      correctly (light/dark, signed-in/out states) in a real browser.
- [x] Resume tailoring pipeline: JD → AI rewrite → PDF (`@react-pdf/renderer`)
      → Blob. Safe-by-construction against fabrication — the model can
      only reword existing content, never touch facts (name, dates,
      employers, etc.); see `docs/ARCHITECTURE.md`. Verified end-to-end
      with a real Gemini call: correctly tailored summary, reordered
      skills, valid downloaded PDF. Download works cross-origin from the
      extension too (the Blob store is private, so this needed its own
      authenticated streaming route, not just a public URL).
- [x] LLM fallback field-mapping + crowdsourced cache (autofill tier 3) —
      `POST /api/autofill/map`. Safe by construction like resume tailoring:
      the model only ever picks a key from a closed, hand-written list of
      known profile attributes (`apps/web/src/lib/field-paths.ts`), never
      returns a value — the real value is resolved from the user's actual
      profile in code. Backed by the crowdsourced `field_mappings` table
      (keyed by domain + normalized field signature), so the same field
      wording on the same ATS only costs one real model call across all
      users, not one per user.
- [x] Application tracking dashboard — full CRUD, auto-populated by the
      extension on Autofill/tailor, grouped-by-status board at
      `/dashboard/applications`. Verified end-to-end (create, upsert-by-url
      dedup, status/notes updates through the real API, delete, per-user
      scoping) — see `docs/ARCHITECTURE.md`.
- [ ] Job matching / aggregation, referral networking, AI career-chat
      copilot — these need a real job-data source or partnership Job Jet
      doesn't have; not fabricating fake data to fill this in.

## License

[MIT](LICENSE) © 2026 Aditya Kumar
