# Job Jet

A Chrome extension that recognizes job application pages on (in principle)
any site, and helps fill them out: autofill from a saved profile, or generate
a resume tailored to the specific job description via AI.

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

## Autofill engine (planned, not yet wired to backend)

Layered matching, cheapest first:
1. Known-site adapter — CSS selector maps for specific ATSs.
2. Generic heuristic — fuzzy/synonym matching on field name/id/label.
3. LLM fallback — unmatched fields sent to the backend, mapped against the
   user's profile schema.

Results are cached per-domain (`field_mappings` table) and reused, so
repeat visits to the same ATS get faster and don't re-hit the LLM.

Known limitation: browsers restrict script-set `input[type=file].files` for
security. The `DataTransfer` workaround handles most sites but some ATSs
(Workday especially) actively resist it.

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
      from the result. **Needs a `GOOGLE_GENERATIVE_AI_API_KEY` env var to
      actually run** — free key at aistudio.google.com/apikey.
- [x] Extension ↔ backend auth wiring: `@clerk/chrome-extension`'s
      `ClerkProvider` in the side panel, `syncHost` pointed at the web app
      with `__experimental_syncHostListener` (live session sync instead of
      requiring the panel to be closed/reopened — a known limitation of the
      SDK without that flag), manifest updated with the `cookies` permission
      it needs. **Not yet fully verified**: needs the built extension's ID
      registered in Clerk's `allowed_origins` (one-time, via the Backend
      API) before cross-origin session sync will actually work — waiting on
      the extension ID from loading it unpacked.
- [x] Local test fixtures for the detection heuristic (see below) — verified
      working in a real browser: floating button shows on the job
      application fixture, stays hidden on the plain-content one.
- [ ] Autofill engine v1 (heuristic + known adapters for Greenhouse/Lever).
- [ ] Resume tailoring pipeline: JD → AI rewrite → PDF (`@react-pdf/renderer`) → Blob.
- [ ] LLM fallback field-mapping + crowdsourced cache.
- [ ] Application tracking dashboard.

## Testing the extension against a fixture page

Real ATS sites are slow and inconsistent to test against repeatedly, so
`apps/extension/test-fixtures/` has two local pages exercising the
detection heuristic directly:

```bash
npm run test:fixtures   # serves http://localhost:4000
```

- `/careers/senior-frontend-engineer/apply/` — a realistic job application
  form (positive case) — the floating button should appear.
- `/about/` — a plain content page (negative control) — it should not.

Verified working: loading the built extension and visiting both pages in a
real browser confirms the button shows/hides exactly as expected.

## Dev

```bash
npm install

# Backend (http://localhost:3000) — apps/web/.env.local already has
# Clerk/Neon/Blob credentials pulled from Vercel (vercel env pull to refresh)
npm run dev:web

# Extension — then load apps/extension/dist as an unpacked extension
# in chrome://extensions (Developer mode on)
npm run dev:extension
```

Schema changes: edit `apps/web/src/db/schema.ts`, then `npm run db:push --workspace=apps/web`.
