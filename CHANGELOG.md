# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
The Chrome extension (`apps/extension`) and web app (`apps/web`) share one version.

## [Unreleased]

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

[Unreleased]: https://github.com/adityakmr7/job-jet/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/adityakmr7/job-jet/releases/tag/v0.1.0
