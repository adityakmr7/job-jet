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
| Authentication | [Better Auth](https://www.better-auth.com) (self-hosted library; accounts, sessions and OAuth links in our Postgres). Password hashing (scrypt), session tokens and OAuth are Better Auth's — no custom crypto. Passwords 10–128 chars. `src/proxy.ts` only does a fast cookie-presence redirect; every API route calls `requireUser(req)` and every dashboard page `requirePageUser()`, which validate the session against the database. |
| Sessions | httpOnly, SameSite=Lax cookies; `Secure` + `__Secure-` prefix in production. 30-day expiry, refreshed daily; sensitive actions (delete account without a password) need a sign-in from the last 24 h. Password reset and password change revoke other sessions. Users can list and revoke sessions (incl. extension) in Account settings. |
| CSRF | SameSite=Lax cookies, Better Auth's origin check on its endpoints (`trustedOrigins` = `BETTER_AUTH_URL` + allowed `chrome-extension://` IDs; kept on even under `NODE_ENV=test`), and `requireUser` rejects cookie-authenticated mutations whose Origin is a foreign site (403). |
| Brute force | Better Auth rate limiting with Postgres storage (`auth_rate_limit`), per IP: sign-in 10/min, sign-up 5/10 min, reset/verification emails 5/10 min, change-password 10/10 min, delete-account 5/10 min. The client IP comes from `x-real-ip` / `x-forwarded-for` (set by Vercel). |
| Email | Verification and reset links are single-use and expire (24 h / 1 h). Email verification is enforced only when an email provider (Resend) is configured — see README "Email verification tradeoff". The dev console sender never prints links in production. Reset requests don't reveal whether an email is registered. |
| Account linking | Google is the only trusted provider for automatic linking by email (Google verifies addresses). |
| Account deletion | Requires the password (or a fresh session for Google-only accounts); deletes the user's Blob files first (fails closed if that fails), then the user row, cascading to all app data, sessions and accounts. |
| Extension tokens | See "Extension authentication" below. |
| Authorization (IDOR) | Every query is scoped by the caller's user id: profile by `userId`; applications `PATCH`/`DELETE` by `id AND userId`; resume downloads check `resume.userId`; attaching a `resumeId` to an application checks ownership (`src/lib/ownership.ts`). Non-owned ids return 404. |
| Resume files | Stored in a **private** Vercel Blob store. Files are only served by `/api/resume/[id]/download` after an ownership check, with a safe `Content-Type` allow-list, `nosniff`, an RFC 5987 `Content-Disposition`, and `no-store`. Blob URLs are never returned by the API. |
| Input validation | zod schemas with size limits on every request body (`src/lib/validation.ts`), a body-size cap in `readJsonBody`, http(s)-only URLs for applications and profile links. |
| AI / prompt injection | Job descriptions are untrusted page text. Model output is always schema-validated (`generateObject` + zod), never executed or rendered as HTML, and only ever written to the calling user's own rows. Tailoring can only reword existing bullets/summary and reorder the user's own skills (facts are copied in code); output length is capped. Field mapping returns only keys from a fixed allow-list; values come from the user's own profile, and cached mappings (shared across users) must pass a type-compatibility check. |
| Abuse | Per-user rate limits on the AI endpoints (`src/lib/rate-limit.ts`; fails open if the DB is unavailable). |
| CORS | Pinned to `ALLOWED_EXTENSION_IDS`; fails closed in production. Never a wildcard, never for web origins. Requests still need a session. |
| Headers | `next.config.ts` sets CSP (`'self'` only for scripts/styles/connections/images, `frame-src 'none'`; Google sign-in is a top-level redirect so needs no CSP entry), `frame-ancestors 'none'` / `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP and HSTS. |
| XSS | No `dangerouslySetInnerHTML`; all user/AI text goes through React escaping. Tailored PDFs are rendered with `@react-pdf/renderer` (text only, no HTML). |
| SSRF | The server never fetches user-supplied URLs. |

### Extension (`apps/extension`)

| Area | Control |
| --- | --- |
| Messaging | `runtime.onMessage` handlers accept only messages from this extension's own id and with a known shape (`src/lib/messages.ts`). `externally_connectable` lists **only** the Job Jet web origin (production builds refuse localhost/http), and the only external message accepted is the connect hand-off, from exactly `<web origin>/extension-connect`, matching a pending nonce. The side panel is only opened for the sender's own tab. |
| Page isolation | The floating button lives in a **closed** shadow root with its own styles. The content script only reads form metadata and job-description text when the side panel asks for it. |
| Filling | Values are written only after the user clicks Autofill, only on the active tab; nothing is submitted automatically. |
| Tokens / storage | The session token is kept in `chrome.storage.local` (extension-only, not readable by web pages or content-script-injected page code). Job Jet stores no profile data in extension storage; it's fetched from the API on demand. |
| CSP | `script-src 'self'; object-src 'self'` for extension pages, so no remote code. |
| Downloads | Server-provided file names are sanitised before `chrome.downloads.download`. |

#### Permission justification

| Permission | Why |
| --- | --- |
| `<all_urls>` host access | Application forms live on thousands of company career sites and ATS domains; there's no fixed list to narrow to. Needed for the content script (form detection) and `scripting` fills. |
| `scripting` | Fills React/Vue-controlled inputs from the page's main world, only when the user clicks Autofill. |
| `storage` | Keeps the extension's own session token (and a short-lived connect nonce) so the user stays signed in. |
| `sidePanel` | The extension's UI. |
| `downloads` | Saves a generated tailored resume PDF so it can be attached to the form. |

`activeTab` was removed because the host permission already covers it; the
`cookies` permission was removed in 0.3.0 (the extension no longer shares the
web app's cookie session). `externally_connectable` (a manifest key, not a
permission) is limited to the Job Jet web origin.

### Extension authentication

Design (details in `docs/ARCHITECTURE.md`):

1. The side panel opens `<web>/extension-connect?ext=<id>&state=<nonce>`; the
   nonce lives in `chrome.storage.session`, expires in 10 minutes and is
   single-use.
2. On an explicit click by the signed-in user, the page calls
   `POST /api/auth/extension/token` with the cookie session (origin-checked).
   The server refuses non-allowlisted extension IDs and bearer-authenticated
   callers, and creates a **separate** session labelled with the extension
   ID, replacing that install's previous one.
3. The token goes to that extension only via `chrome.runtime.sendMessage`;
   Chrome delivers it only because the manifest's `externally_connectable`
   lists the web origin. The background worker verifies the exact sender
   origin + path, the message schema and the nonce before storing it. If the
   hand-off fails, the page revokes the unused session.
4. The extension sends `Authorization: Bearer` with `credentials: "omit"`;
   on 401 it discards the token and asks the user to reconnect. Sign-out
   revokes the session server-side, then clears local storage.

Server-side bearer rules: an Authorization header is ignored when the request
carries a non-extension Origin (browsers always send Origin cross-origin and
pages can't forge `chrome-extension://`); a bearer session must be an
extension session for a still-allowlisted ID (matching the Origin when there
is one), so a stolen web cookie can't be used as a bearer token and removing
an ID from `ALLOWED_EXTENSION_IDS` disables its tokens. Tokens are
HMAC-signed with `BETTER_AUTH_SECRET` (Better Auth `bearer({ requireSignature:
true })`), so database contents alone can't be replayed. The auth route never
reads cookies from, or sets cookies on, extension/bearer requests.

**Why `chrome.storage.local`, not `.session`:** `.session` is cleared on every
browser restart, which would force a reconnect each day for an extension used
throughout a job search. `.local` is still private to the extension; the risk
it adds (a token at rest in the Chrome profile) is bounded by server-side
expiry (30 days), per-install revocation from Account settings, and
revocation on password change/reset.

**Why not the Clerk-style cookie sync:** it needs the `cookies` permission,
couples the extension to the web session, and offers no per-install
revocation.

## Known limitations / accepted risks

- CSP uses `'unsafe-inline'` for scripts and styles (Next.js inline bootstrap scripts, without per-request nonces). It still blocks framing, plugins, `<base>` hijacking, off-origin form posts and off-origin script/connect targets.
- The crowdsourced field-mapping cache is shared across users. A user can influence which *profile key* a field on a domain maps to (never a value, and only type-compatible keys), so the worst case is a wrong field being filled for other users on that site. Users review forms before submitting.
- The build tool (crxjs) exposes the content-script loader chunk as a web-accessible resource, so pages can detect that the extension is installed. It contains no data.
- Rate limiting fails open if the database is unavailable, so the app keeps working.
- `npm audit` reports advisories only in dev-only tooling (vite, esbuild via drizzle-kit/vitest). None of them ship in the extension or the web app. Re-check them on each release.
- Without an email provider, email ownership isn't verified and password reset can't work in production (see README). Configure Resend before launch.
- An extension token at rest in `chrome.storage.local` could be read by malware with access to the Chrome profile; it's revocable and expires (see above).
