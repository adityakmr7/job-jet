/**
 * HTTP security headers for every web-app response, wired up in
 * next.config.ts. Kept as a pure function so it's unit-testable.
 *
 * CSP notes:
 * - Authentication is first-party (Better Auth, same origin), so scripts,
 *   styles and connections are limited to 'self'. Google sign-in is a
 *   top-level redirect to accounts.google.com and back to
 *   /api/auth/callback/google — navigations aren't governed by
 *   connect-src/form-action, so no Google origins are needed.
 * - Next.js injects inline bootstrap scripts; without per-request nonces
 *   (which would force every page to render dynamically) 'unsafe-inline'
 *   is required for script-src. The policy still blocks framing, plugins,
 *   <base> hijacking, off-origin form posts, and scripts/connections to any
 *   other origin.
 * - 'unsafe-eval' and ws: are only added in development (React Refresh / HMR).
 */

export interface SecurityHeaderOptions {
  isDev?: boolean;
}

export function buildContentSecurityPolicy({ isDev = false }: SecurityHeaderOptions = {}): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...(isDev ? ["ws:"] : [])],
    "frame-src": ["'none'"],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  if (!isDev) directives["upgrade-insecure-requests"] = [];

  return Object.entries(directives)
    .map(([name, values]) => [name, ...values].join(" "))
    .join("; ");
}

export function buildSecurityHeaders(options: SecurityHeaderOptions = {}): { key: string; value: string }[] {
  const headers = [
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy(options) },
    // Legacy equivalent of frame-ancestors 'none' for older browsers.
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
    // same-origin-allow-popups keeps OAuth popups working if ever used.
    { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  ];
  if (!options.isDev) {
    headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
  }
  return headers;
}
