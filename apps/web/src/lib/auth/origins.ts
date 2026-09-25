import { corsConfigFromEnv, isAllowedExtensionOrigin, type CorsConfig } from "../cors";
import { parseList, type EnvSource } from "../env";

/**
 * Pure origin/redirect policy for authentication, kept free of Better Auth
 * and Next imports so it's unit-testable.
 */

export const EXTENSION_ID_RE = /^[a-p]{32}$/;

export function isValidExtensionId(id: unknown): id is string {
  return typeof id === "string" && EXTENSION_ID_RE.test(id);
}

/** Whether `id` may receive an extension session token. Same policy as CORS:
 *  the ALLOWED_EXTENSION_IDS allowlist; if empty, any well-formed ID in
 *  development and none in production (fail closed). */
export function isAllowedExtensionId(id: unknown, config: CorsConfig = corsConfigFromEnv()): boolean {
  return isValidExtensionId(id) && isAllowedExtensionOrigin(`chrome-extension://${id}`, config);
}

/** Origins Better Auth accepts for state-changing requests (its CSRF /
 *  origin check) and callback URLs: the app itself plus each allowed
 *  extension. In development with no allowlist, the requesting extension's
 *  own origin is echoed back so a fresh unpacked build works. */
export function resolveTrustedOrigins(
  requestOrigin: string | null | undefined,
  env: EnvSource = process.env
): string[] {
  const origins = new Set<string>();
  const baseUrl = env.BETTER_AUTH_URL?.trim();
  if (baseUrl) {
    try {
      origins.add(new URL(baseUrl).origin);
    } catch {
      // Misconfigured BETTER_AUTH_URL — Better Auth itself reports this.
    }
  }
  for (const id of parseList(env.ALLOWED_EXTENSION_IDS)) {
    if (isValidExtensionId(id)) origins.add(`chrome-extension://${id}`);
  }
  const cors = corsConfigFromEnv(env);
  if (requestOrigin && cors.allowedExtensionIds.length === 0 && isAllowedExtensionOrigin(requestOrigin, cors)) {
    origins.add(requestOrigin);
  }
  return [...origins];
}

/** Label stored on extension sessions (session.user_agent) so they're
 *  recognisable in the DB, replaceable per install, and bindable to the
 *  extension that owns them. */
export function extensionSessionLabel(extensionId: string): string {
  return `Job Jet extension (${extensionId})`;
}

const LABEL_RE = /^Job Jet extension \(([a-p]{32})\)$/;

export function extensionIdFromSessionLabel(label: string | null | undefined): string | null {
  return (label && LABEL_RE.exec(label)?.[1]) || null;
}

/**
 * Bearer tokens are only for the Chrome extension. `Authorization` is
 * dropped (the request is then cookie-authenticated or anonymous) when the
 * request carries an Origin that isn't an allowed extension origin — every
 * browser sends Origin on cross-origin fetches and preflights, and a web page
 * can't forge a chrome-extension:// Origin, so a leaked token can't be used
 * from a website.
 *
 * A request with *no* Origin keeps its Authorization header: Chrome omits
 * Origin on GET requests an extension makes to hosts it has permissions for,
 * and non-browser clients never send one. Those tokens are still bound to
 * the extension by isBearerSessionAllowed (below).
 */
export function withTrustedAuthorization(headers: Headers, config: CorsConfig = corsConfigFromEnv()): Headers {
  if (!headers.has("authorization")) return headers;
  const origin = headers.get("origin");
  if (!origin || isAllowedExtensionOrigin(origin, config)) return headers;
  const copy = new Headers(headers);
  copy.delete("authorization");
  return copy;
}

/**
 * A bearer-authenticated session must be an extension session minted by
 * /api/auth/extension/token for a currently allowed extension ID, and when
 * the request has an Origin it must be that same extension. So a web
 * session cookie can't be replayed as a bearer token, and one extension's
 * token can't be used by another.
 */
export function isBearerSessionAllowed(
  sessionLabel: string | null | undefined,
  origin: string | null | undefined,
  config: CorsConfig = corsConfigFromEnv()
): boolean {
  const id = extensionIdFromSessionLabel(sessionLabel);
  if (!id || !isAllowedExtensionId(id, config)) return false;
  return !origin || origin === `chrome-extension://${id}`;
}

/** True if a cookie-authenticated, state-changing request comes from a
 *  foreign web origin (defence in depth on top of SameSite=Lax cookies). */
export function isCrossSiteMutation(method: string, headers: Headers, appOrigin: string | undefined): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) return false;
  const origin = headers.get("origin");
  if (!origin || !appOrigin) return false;
  if (origin === appOrigin) return false;
  // Extension requests are authenticated by bearer token, not cookies.
  if (origin.startsWith("chrome-extension://")) return false;
  return true;
}

/** Only same-site relative paths are allowed as post-auth redirects
 *  (blocks open redirects like `//evil.com` or `https://evil.com`). */
export function safeRedirectPath(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value || typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}
