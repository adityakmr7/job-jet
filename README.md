# Job Jet

A Chrome extension that recognizes job application pages on (in principle)
any site, and helps fill them out: autofill from a saved profile, or generate
a resume tailored to the specific job description via AI.

Full system design, data model, and the reasoning behind what's built (and
deliberately not built) is in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Structure

```
apps/
  web/         Next.js app — auth, dashboard, all backend API routes
  extension/   Chrome MV3 extension (Vite + CRXJS + React), side panel UI
packages/
  shared/      Shared TS types/zod schemas: Profile, Resume, Application, FieldMapping
```

## Stack

- **Extension**: Manifest V3, Vite + `@crxjs/vite-plugin`, React side panel.
- **Backend**: Next.js (App Router) API routes on Vercel.
- **Auth**: Clerk — has an official `@clerk/chrome-extension` SDK that syncs
  the web app's session into the extension. Multi-user from day one.
- **Database**: Neon Postgres (via Drizzle).
- **File storage**: Vercel Blob (uploaded resumes + generated tailored PDFs).
- **AI**: AI SDK, using the Google provider against a free Gemini API key for
  dev, behind an `AI_PROVIDER` abstraction so it's a one-line swap later.

## How detection works

`apps/extension/src/lib/detect.ts` — a fast-path hostname allowlist for known
ATSs (Greenhouse, Lever, Workday, Ashby, iCIMS, SmartRecruiters, LinkedIn,
etc.) OR'd with a generic scored heuristic (URL/title keywords, page-text
keywords like "cover letter" / "work authorization", form-field name/label
keywords, presence of a file upload, input count) so bespoke company career
pages and unlisted ATSs still get picked up. Runs on `document_idle` and
re-runs on SPA route changes via a `MutationObserver`, since job boards are
almost all client-side routed.

On a positive detection, a floating button is injected into a shadow DOM
(host-page-CSS-proof) in the bottom-right corner. Clicking it opens the
`chrome.sidePanel`, which shows the saved profile, an "Autofill" action, and
a "Generate tailored resume for this job" action (auto-extracts the JD text
from the page).

## Autofill engine

Layered matching, cheapest first:
1. **Heuristic (done)** — `apps/extension/src/lib/autofill-map.ts` matches
   detected fields against the user's saved profile purely by name/id/label
   keyword, entirely client-side. Fetches the profile from `/api/profile`
   cross-origin (the extension's Clerk session token as a Bearer header —
   see `src/lib/api.ts` and the backend's `src/lib/cors.ts`). Deliberately
   never fills voluntary EEO self-identification fields (gender, ethnicity,
   veteran/disability status, pronouns) — those stay opt-in and manual.
2. **Known-site adapter** (not built) — CSS selector maps for specific ATSs.
3. **LLM fallback** (not built) — unmatched fields sent to the backend,
   mapped against the user's profile schema, cached per-domain in the
   `field_mappings` table so repeat visits to the same ATS don't re-hit the LLM.

Known limitation: browsers restrict script-set `input[type=file].files` for
security, so resume/file fields are never auto-filled — the side panel
message says so explicitly. A `DataTransfer` workaround exists for some
sites but is not implemented yet.

## Roadmap

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
      it needs. **Not yet fully verified**: needs the built extension's ID
      registered in Clerk's `allowed_origins` (one-time, via the Backend
      API) before cross-origin session sync will actually work — waiting on
      the extension ID from loading it unpacked.
- [x] Local test fixtures for the detection heuristic (see below): a
      single-step form, a 5-step wizard (fields only exist in the DOM for
      the active step, URL hash changes per step — the harder/more
      realistic SPA-wizard case), and a negative control. All three
      verified working in a real browser.
- [x] Autofill engine v1 (heuristic tier) — see above. Code complete,
      type-checks, builds; **not yet live-verified** (Chrome caches a
      loaded unpacked extension — needs a manual reload after each
      rebuild, which can't be done from here; see "Reload needed" below).
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
- [ ] Resume tailoring pipeline: JD → AI rewrite → PDF (`@react-pdf/renderer`) → Blob.
- [ ] LLM fallback field-mapping + crowdsourced cache.
- [ ] Application tracking dashboard (`applications` table exists in the
      schema, unused so far).
- [ ] Job matching / aggregation, referral networking, AI career-chat
      copilot — these need a real job-data source or partnership Job Jet
      doesn't have; not fabricating fake data to fill this in.

### Reload needed to test recent changes

Two things changed since the extension was last loaded and need a manual
reload in `chrome://extensions` (click the card's reload icon) before
they're testable:
- The autofill engine (Autofill button now actually fills fields).
- A detection false-positive fix: the heuristic used to fire on Job Jet's
  own landing page (it mentions "resume", "job description", "work
  authorization" enough to look like an application page by text alone,
  despite having zero real form fields) — found by dogfooding it. Text
  keywords are no longer sufficient alone; real form-field evidence is
  now required too.

## Testing the extension against fixture pages

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

## Dev

```bash
npm install

# Backend (http://localhost:3001 — pinned; port 3000 may already be taken
# by something else on your machine). apps/web/.env.local already has
# Clerk/Neon/Blob credentials pulled from Vercel (vercel env pull to refresh).
npm run dev:web

# Extension — then load apps/extension/dist as an unpacked extension
# in chrome://extensions (Developer mode on). After any rebuild, click
# that extension's reload icon in chrome://extensions — Chrome doesn't
# pick up on-disk changes to an already-loaded unpacked extension on its own.
npm run dev:extension
```

If you change `apps/extension/.env.development`'s `VITE_CLERK_SYNC_HOST`
away from `http://localhost:3001`, keep it matched to whatever port
`npm run dev:web` actually binds to (it prints the real port on startup).

Schema changes: edit `apps/web/src/db/schema.ts`, then `npm run db:push --workspace=apps/web`.
