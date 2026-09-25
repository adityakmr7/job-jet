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
- **Auth**: Clerk — the official `@clerk/chrome-extension` SDK syncs the web
  app's session into the extension. Multi-user from day one.
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
npm run db:migrate --workspace=apps/web        # create tables (new database)
npm run dev:web

# 2. Extension
cp apps/extension/.env.example apps/extension/.env.development   # dev section
npm run dev:extension
```

Then load `apps/extension/dist` as an unpacked extension in
`chrome://extensions` (Developer mode on). After a rebuild, click the
extension's reload icon — Chrome doesn't pick up on-disk changes to an
already-loaded unpacked extension on its own.

For session sync, register the extension's origin
(`chrome-extension://<id>`, shown on `chrome://extensions`) in Clerk's
`allowed_origins`, and keep `VITE_CLERK_SYNC_HOST` matched to the port
`npm run dev:web` actually binds to.

## Environment variables

### Web (`apps/web/.env.example`)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API key (resume parsing, tailoring, autofill matching) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | Clerk auth |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob (private store) |
| `ALLOWED_EXTENSION_IDS` | Comma-separated Chrome extension IDs allowed by CORS. Empty = any extension in dev, **none in production** |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Contact address shown on `/privacy` and `/terms` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Optional: `/sign-in`, `/sign-up` |

Secrets are read lazily at request time, so `next build` works without them.

### Extension (`apps/extension/.env.example`)

| Variable | Purpose |
| --- | --- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Same publishable key as the web app |
| `VITE_CLERK_SYNC_HOST` | Web app origin: Clerk sync host **and** API base URL; its host is excluded from job detection |
| `JOBJET_ALLOW_DEV_CONFIG` | Optional, not bundled: `true` downgrades production checks to warnings |

The build **fails** if a required value is missing or malformed. Production
builds (`npm run build`, mode `production`, reads `.env.production`) also fail
if the backend is localhost / not https or the Clerk key is `pk_test_`. Use
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
  error handling, field-path resolution, and the AI-output merge logic
  (the AI SDK is mocked; no network or database needed).
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
`sk_live_` Clerk keys, `ALLOWED_EXTENSION_IDS` with the Chrome Web Store
extension ID, `NEXT_PUBLIC_CONTACT_EMAIL`). Run migrations against the
production database before (or right after) deploying a release that
includes a new migration.

**Extension (Chrome Web Store):** once the production domain and live Clerk
key exist, run this from the repo root:

```bash
cat > apps/extension/.env.production <<'ENV'
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...           # same key as the web app's NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
VITE_CLERK_SYNC_HOST=https://<your-domain>       # deployed web app origin, no trailing slash
ENV
npm ci && npm run release:extension
# -> release/job-jet-extension-v<version>.zip  (git-ignored; upload this file)
```

The build refuses `pk_test_` keys, `http://` hosts and localhost in production
mode. Store listing text, permission justifications and images are in
[`store-assets/`](store-assets/LISTING.md). The listing also needs the public
privacy policy URL (`https://<your-domain>/privacy`). After the first upload,
add the store extension ID to `ALLOWED_EXTENSION_IDS` (web env) and to Clerk's
`allowed_origins`.

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
  every route still requires a Clerk session.
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
   cross-origin (the extension's Clerk session token as a Bearer header —
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
