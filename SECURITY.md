# Security

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Use GitHub's
[private vulnerability reporting](https://github.com/adityakmr7/job-jet/security/advisories/new)
for this repository, or email the contact address listed on the site's
`/privacy` page. Include steps to reproduce and the impact you observed. We
aim to acknowledge reports within 3 business days.

Only the latest release of the extension and the currently deployed web app
are supported.

## Threat model (summary)

Job Jet handles resumes and job-application profiles (names, contact
details, work history), so the main risks are cross-user data access, data
leaking to the pages the extension runs on, and untrusted job-page content
steering the AI features.

### Web app (`apps/web`)

| Area | Control |
| --- | --- |
| Authentication | Clerk. `src/proxy.ts` protects `/dashboard` and `/api`, and every route/page also checks the session itself (`getOrCreateUser()` / `auth()`). |
| Authorization (IDOR) | Every query is scoped by the caller's user id: profile by `userId`; applications `PATCH`/`DELETE` by `id AND userId`; resume downloads check `resume.userId`; attaching a `resumeId` to an application checks ownership (`src/lib/ownership.ts`). Non-owned ids return 404. |
| Resume files | Stored in a **private** Vercel Blob store. Files are only served by `/api/resume/[id]/download` after an ownership check, with a safe `Content-Type` allow-list, `nosniff`, an RFC 5987 `Content-Disposition`, and `no-store`. Blob URLs are never returned by the API. |
| Input validation | zod schemas with size limits on every request body (`src/lib/validation.ts`), a body-size cap in `readJsonBody`, http(s)-only URLs for applications and profile links. |
| AI / prompt injection | Job descriptions are untrusted page text. Model output is always schema-validated (`generateObject` + zod), never executed or rendered as HTML, and only ever written to the calling user's own rows. Tailoring can only reword existing bullets/summary and reorder the user's own skills (facts are copied in code); output length is capped. Field mapping returns only keys from a fixed allow-list; values come from the user's own profile, and cached mappings (shared across users) must pass a type-compatibility check. |
| Abuse | Per-user rate limits on the AI endpoints (`src/lib/rate-limit.ts`; fails open if the DB is unavailable). |
| CORS | Pinned to `ALLOWED_EXTENSION_IDS`; fails closed in production. Requests also need a Clerk Bearer token. |
| Headers | `next.config.ts` sets CSP (self + the Clerk Frontend API derived from the publishable key + Cloudflare Turnstile), `frame-ancestors 'none'` / `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP and HSTS. |
| XSS | No `dangerouslySetInnerHTML`; all user/AI text goes through React escaping. Tailored PDFs are rendered with `@react-pdf/renderer` (text only, no HTML). |
| SSRF | The server never fetches user-supplied URLs. |

### Extension (`apps/extension`)

| Area | Control |
| --- | --- |
| Messaging | `runtime.onMessage` handlers accept only messages from this extension's own id and with a known shape (`src/lib/messages.ts`). No `externally_connectable`, so web pages can't message the extension. The side panel is only opened for the sender's own tab. |
| Page isolation | The floating button lives in a **closed** shadow root with its own styles. The content script only reads form metadata and job-description text when the side panel asks for it. |
| Filling | Values are written only after the user clicks Autofill, only on the active tab; nothing is submitted automatically. |
| Tokens / storage | Clerk keeps its session in `chrome.storage` (extension-only storage, not readable by web pages). Job Jet stores no profile data in extension storage; it's fetched from the API on demand. |
| CSP | `script-src 'self'; object-src 'self'` for extension pages, so no remote code. |
| Downloads | Server-provided file names are sanitised before `chrome.downloads.download`. |

#### Permission justification

| Permission | Why |
| --- | --- |
| `<all_urls>` host access | Application forms live on thousands of company career sites and ATS domains; there's no fixed list to narrow to. Needed for the content script (form detection) and `scripting` fills. |
| `scripting` | Fills React/Vue-controlled inputs from the page's main world, only when the user clicks Autofill. |
| `storage` | Required by Clerk to keep the extension signed in. |
| `cookies` | Required by Clerk's session sync with the Job Jet web app. |
| `sidePanel` | The extension's UI. |
| `downloads` | Saves a generated tailored resume PDF so it can be attached to the form. |

`activeTab` was removed because the host permission already covers it.

## Known limitations / accepted risks

- CSP uses `'unsafe-inline'` for scripts and styles (Next.js inline bootstrap scripts and Clerk UI, without per-request nonces). It still blocks framing, plugins, `<base>` hijacking, off-origin form posts and off-origin script/connect targets.
- The crowdsourced field-mapping cache is shared across users. A user can influence which *profile key* a field on a domain maps to (never a value, and only type-compatible keys), so the worst case is a wrong field being filled for other users on that site. Users review forms before submitting.
- The build tool (crxjs) exposes the content-script loader chunk as a web-accessible resource, so pages can detect that the extension is installed. It contains no data.
- Rate limiting fails open if the database is unavailable, so the app keeps working.
- `npm audit` reports advisories in dev-only tooling (vite/esbuild/drizzle-kit) and in transitive dependencies of `@clerk/chrome-extension`. None of them are reachable from shipped code paths. Re-check them on each release.
