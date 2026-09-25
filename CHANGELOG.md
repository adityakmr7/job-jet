# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
The Chrome extension (`apps/extension`) and web app (`apps/web`) share one version.

## [Unreleased]

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

[Unreleased]: https://github.com/adityakmr7/job-jet/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/adityakmr7/job-jet/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/adityakmr7/job-jet/releases/tag/v0.1.0
