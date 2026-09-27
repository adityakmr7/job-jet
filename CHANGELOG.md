# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
The Chrome extension (`apps/extension`) and web app (`apps/web`) share one version.

## [Unreleased]

### Added — saved answers bank

- **Saved answers** in the dashboard profile (`/dashboard#saved-answers`):
  how you heard about the company (default answer), notice period, earliest
  start date, salary expectation (amount, currency, per year/month/hour),
  willingness to relocate, preferred work modes in order, and years of
  experience.
- **Work authorization by country**: a list of countries, each with
  "authorized to work" and "needs sponsorship". When a question names a
  country (Poland, Canada, the UK, India, the US and about 25 others), the
  matching entry is used. The existing single answers stay the default for
  questions that don't name a country. If you keep a list and the question
  names a country that isn't on it, the question is left for you.
- **Your own questions**: free-form question and answer pairs. A form
  question is matched when it contains every meaningful word of your saved
  question; the most specific match wins. Old `additionalQuestions` entries
  move into this list the next time you save your profile.
- **Voluntary questions**: pronouns plus gender, race/ethnicity,
  Hispanic/Latino, veteran, disability, LGBTQ+, transgender and sexual
  orientation. Each defaults to **Never fill**. You can pick "Decline to
  answer", which selects the form's decline option, or set your own answer.
  Nothing is filled unless you choose to.
- Autofill uses these answers on Greenhouse, Lever, Ashby and Workable text
  fields, selects, radios, comboboxes and date pickers. For example, a
  salary is converted between yearly and monthly, a date picker gets today
  plus your notice period, notice-period dropdowns are matched, and
  years-of-experience ranges are picked.
- The AI tier can use saved answers as allowed facts (`referralSource`,
  `noticePeriod`, `earliestStartDate`, `salaryExpectation`,
  `willingToRelocate`, `workMode` and your own `custom:<id>` questions).
  Voluntary answers and pronouns are never offered to the model. Mappings to
  your own questions are never written to the shared cache.
- The side panel has a new **Left for you** card that lists questions
  autofill didn't answer. **Save my answers…** reads what you typed into
  those fields and saves the ones you tick to your questions
  (`POST /api/profile/answers`). An **Edit saved answers** link opens the
  dashboard section.

### Changed

- `PUT /api/profile` is rate-limited (shares a new `profileWrite` limit of
  120 writes per hour with `/api/profile/answers`) and returns field-level
  validation errors. All saved-answer text is trimmed, stripped of control
  characters and length-capped.
- `yearsOfExperience` for the AI tier now uses the saved value, or the span
  of your work history. It used to return the number of roles.

### Database

- Migration `0003_add_application_answers` adds a nullable
  `profiles.application_answers` jsonb column. It is backwards compatible,
  and it **must be applied to production** (`npm run db:migrate:env
  --workspace=apps/web` with the production `DATABASE_URL`) before this
  build of the web app is deployed.

## [0.4.0-beta] - 2026-09-27

First Chrome Web Store build, published **Unlisted** as a beta for invited
testers. The manifest has `version` `0.4.0` and `version_name` `0.4.0 beta`.

### Fixed (autofill, from live testing on 18 Greenhouse, Lever, Ashby and Workable postings)

- Question labels are read from `aria-labelledby`, `label[for]`, wrapping
  labels and the nearest question title (Lever, Ashby, Workable, Greenhouse,
  fieldset legends). Radios and checkboxes keep their option text separately
  from the group question.
- Visually hidden radios and checkboxes that have a visible stand-in are no
  longer dropped as honeypots. Ashby Yes/No button questions are detected
  and answered.
- Type-to-search location comboboxes (Greenhouse, Ashby, Lever) are filled
  only when exactly one suggestion matches; otherwise they are left empty.
- The name rule skips referral, recruiter, emergency-contact, reference,
  manager and preferred-name questions.
- Street and zip are never filled from the location string. City, state and
  country are filled only when they can be derived. Country selects get the
  derived country.
- GitHub is filled only into URL, profile or username fields. Company is not
  filled into size, industry or preference questions.
- A radio is ticked only when the option itself matches the answer, and
  nothing is ever unticked.
- More sensitive questions are never filled: sexual orientation, gender
  identity, ethnicity, disability, veteran status, religion, marital status,
  national origin, age and caste.
- Work authorization and sponsorship answers reach Yes/No dropdowns, radios
  and buttons.
- "Other website" is no longer a copy of the portfolio URL.

### Added

- Application forms inside embedded ATS iframes (for example Greenhouse on
  careers.airbnb.com) can be detected and filled. Content scripts now run in
  all frames but stay inert outside the top frame unless the frame is a
  known ATS host.
- The stored or tailored resume is attached to the form's own resume input.
  It is never put into an "autofill from resume" importer and never
  replaces a file you already picked.

### Changed

- The floating button appears only when there is real application-form
  evidence. It no longer shows on captcha, sign-in or job-description pages
  just because the host is a known ATS.

## [0.3.0] - 2026-09-25

### Changed

- **Authentication moved from Clerk to [Better Auth](https://www.better-auth.com)**
  (self-hosted library). Accounts, sessions, OAuth links and verification
  tokens now live in our own Postgres (Drizzle adapter); no hosted auth
  service is involved.
- **Extension sign-in:** the side panel's **Connect to Job Jet** opens
  `/extension-connect` on the website, which (after an explicit click) mints
  a dedicated, individually revocable session for that extension install and
  hands it over via `externally_connectable` messaging. The extension sends
  it as a bearer token, prompts to reconnect when it expires, and revokes it
  on sign-out.
- CSP no longer allows Clerk or Cloudflare Turnstile origins: scripts,
  styles, connections and images are `'self'` only; `frame-src 'none'`.
- Extension build config: only `VITE_API_BASE_URL` is required (replaces
  `VITE_CLERK_SYNC_HOST` and `VITE_CLERK_PUBLISHABLE_KEY`).
- `ALLOWED_EXTENSION_IDS` now also decides which extensions may connect to
  accounts and use bearer tokens.
- Privacy policy and terms describe self-hosted accounts and Google OAuth
  instead of Clerk.

### Added

- Email + password sign-up/sign-in (10–128 characters), **Continue with
  Google** (when configured), forgot/reset password, email verification
  pages, all built on the Job Jet design system with accessible labels and
  error states.
- Pluggable email sender: Resend (`RESEND_API_KEY`, `EMAIL_FROM`) or a
  development console sender. Email verification is enforced when Resend is
  configured.
- **Account settings** (`/dashboard/account`): sign-in methods, change
  password, list/revoke sessions (including the extension), and delete
  account (removes all data and resume files).
- User menu (dashboard, account settings, sign out) on the site header and
  dashboard.
- Auth rate limiting stored in Postgres (`auth_rate_limit`).
- Migration `0002_better_auth`: Better Auth tables; existing users keep their
  ids and data; app tables reference `user.id` with cascading deletes.
- Optional `scripts/migrate-clerk-users.mjs` (`npm run auth:migrate-clerk`)
  to import a Clerk users export (dry run by default).
- Local development against a plain Postgres (`localhost` `DATABASE_URL`
  uses node-postgres).
- Tests: real Better Auth + API routes against PGlite (401s, bearer origin
  and session binding, IDOR, sign-out, account deletion), migration and
  Clerk-import tests, email senders, origin policy, and extension
  connect/token-storage/expiry tests.

### Removed

- `@clerk/nextjs`, `@clerk/chrome-extension` and the Clerk agent skills.
- The extension's `cookies` permission.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`,
  `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`,
  `VITE_CLERK_PUBLISHABLE_KEY` and `VITE_CLERK_SYNC_HOST`.

### Security

- Bearer tokens are ignored from web origins and must belong to an
  extension session of an allowlisted extension ID; tokens are HMAC-signed.
- Cookie-authenticated cross-site mutations get 403; Better Auth's origin
  check stays on.
- `npm audit`: the Clerk/Solana transitive advisories are gone (22 → 7); the
  remaining ones are dev tooling only.

## [0.2.0] - 2026-09-25

### Added

- **New visual identity and design system:** an original logo (a "J" that
  takes off as an arrow), ultramarine and "afterburner" orange colour tokens,
  a type scale, radius and shadow tokens, and shared web UI components (Button,
  Card, Badge, Field, Alert, Toast, EmptyState, Skeleton). Documented in
  `DESIGN.md`.
- **Landing page redesign:** hero with a product mock-up, value props, how it
  works, feature deep-dives (autofill, tailored resumes, tracker), a "you stay
  in control" section, FAQ, install CTA, and a multi-column footer with
  privacy/terms links. `NEXT_PUBLIC_EXTENSION_URL` drives the "Add to Chrome"
  buttons.
- Split-screen sign-in and sign-up pages.
- Dashboard: mobile navigation tabs (previously there was no navigation on
  small screens), a profile-strength ring, visible labels on every field,
  dropzone-style resume upload with progress, application stats, status
  colours, toasts for save and delete results, route-level loading skeletons,
  and an error boundary.
- Extension side panel redesign: page summary with detected hostname and job
  title, fill progress, a local **skill match** (which of your profile skills
  the job post mentions), an expandable job description, toned status alerts,
  and loading skeletons.
- Refreshed in-page launcher ("Autofill with Job Jet") that can be hidden for
  the current page.
- Extension icons at 16/32/48/128 from the new logo, plus Chrome Web Store
  assets and a draft listing in `store-assets/`.
- `SECURITY.md` (vulnerability reporting, threat model, permission
  justifications).

### Changed

- Extension name is now "Job Jet — Autofill Job Applications & Tailor Your
  Resume", and the description was updated to match (the old name said
  "Auto Apply", which it never does).
- Accessibility: consistent `:focus-visible` rings, AA-contrast muted text,
  skip-to-content link, `aria-current` in navigation, live regions for
  status messages, and reduced-motion support.

### Security

- Web: CSP (self plus the Clerk Frontend API derived from the publishable key,
  plus Turnstile), `frame-ancestors 'none'`/`X-Frame-Options`, `nosniff`,
  `Referrer-Policy`, `Permissions-Policy`, COOP and HSTS. Removed the
  `X-Powered-By` header.
- Resume downloads: allow-listed `Content-Type`, `nosniff`, `no-store`, and an
  RFC 5987 `Content-Disposition`. Non-ASCII file names used to make the
  download route error, and quotes and control characters are now stripped.
- API responses no longer include internal Blob storage URLs.
- Tailoring prompt fences the job description as untrusted data, and AI
  output length is capped.
- Profile links must be `http(s)` URLs.
- Extension: `runtime.onMessage` handlers accept only messages from the
  extension itself with a known shape. The launcher uses a closed shadow root.
  Download file names are sanitised. Dropped the redundant `activeTab`
  permission. Explicit extension-page CSP. `minimum_chrome_version` is 116.

## [0.1.0] - 2026-09-25

First public release.

### Added

- **Chrome extension (Manifest V3)**
  - Job-application page detection on any site: known-ATS hostname fast path
    plus a content/DOM heuristic, re-run on SPA route changes; Job Jet's own
    web app is never flagged.
  - Floating "Fill with Job Jet" button and a side panel UI.
  - Three-tier autofill engine: client-side keyword heuristics, known-site
    adapters for Greenhouse, Lever and Ashby (verified against live postings),
    and an LLM fallback for unrecognized fields backed by a crowdsourced
    per-site mapping cache.
  - Main-world filling that works with React-controlled inputs, shadow-DOM
    support, honeypot-field exclusion, and deliberate skipping of voluntary
    EEO questions and file inputs.
  - Auto-continue for multi-step application wizards.
  - One-click tailored resume generation from the page's job description,
    saved straight to Downloads.
  - Clerk sign-in with session sync to the web app.
- **Web app (Next.js)**
  - Landing page, sign-in/sign-up (Clerk) and dashboard app shell.
  - Profile editor with a live completeness checklist.
  - Resume upload (PDF/DOCX) with AI parsing (Gemini `gemini-2.5-flash`) into
    a structured profile.
  - Resume tailoring pipeline: job description → AI rewrite of existing
    content only (no fabricated facts, enforced in code) → PDF → private
    Vercel Blob storage.
  - Applications tracker (status, notes, linked resume) fed by the extension.
  - Privacy Policy (`/privacy`) and Terms of Service (`/terms`) pages.
- **Security and operations**
  - Per-user rate limits on AI endpoints (Postgres-backed), request size
    limits and zod validation on API routes, CORS pinned to allowed extension
    IDs, ownership checks for linked resumes, consistent JSON error responses.
  - Drizzle SQL migrations (`apps/web/drizzle`) with a baseline helper for
    databases previously created with `db:push`.
  - Build-time validation of the extension's environment (fails on missing
    values, and on dev values in production builds).
  - Vitest unit test suites for all workspaces, GitHub Actions CI (lint,
    typecheck, tests, extension build, web build), and a script to package
    the extension for the Chrome Web Store.
  - MIT license.

[Unreleased]: https://github.com/adityakmr7/job-jet/compare/v0.4.0-beta...HEAD
[0.4.0-beta]: https://github.com/adityakmr7/job-jet/compare/v0.3.0...v0.4.0-beta
[0.3.0]: https://github.com/adityakmr7/job-jet/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/adityakmr7/job-jet/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/adityakmr7/job-jet/releases/tag/v0.1.0
