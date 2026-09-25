/**
 * HTTP security headers for every web-app response, wired up in
 * next.config.ts. Kept as a pure function so it's unit-testable and so the
 * Content-Security-Policy can be derived from the Clerk publishable key
 * (the Clerk Frontend API host is encoded in it) at build time.
 *
 * CSP notes:
 * - Next.js injects inline bootstrap scripts, and Clerk's hosted UI needs
 *   inline styles; without per-request nonces (which would force every
 *   page to render dynamically) 'unsafe-inline' is required for
 *   script-src/style-src. The policy still blocks framing, plugins,
 *   <base> hijacking, off-origin form posts, and scripts/connections to
 *   any origin other than ours + Clerk.
 * - 'unsafe-eval' is only added in development (React Refresh needs it).
 * - Clerk requirements follow https://clerk.com/docs/security/clerk-csp.
 */

export interface SecurityHeaderOptions {
  /** NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY — used to find the Clerk Frontend API host. */
  clerkPublishableKey?: string;
  isDev?: boolean;
}

/** Decodes the Clerk Frontend API origin from a publishable key
 *  (`pk_(test|live)_` + base64("<host>$")). Returns null if malformed. */
export function clerkFrontendApiOrigin(publishableKey: string | undefined): string | null {
  const match = /^pk_(test|live)_(.+)$/.exec(publishableKey ?? "");
  if (!match) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(match[2], "base64").toString("utf8");
  } catch {
    return null;
  }
  const host = decoded.replace(/\$$/, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) return null;
  return `https://${host}`;
}

export function buildContentSecurityPolicy({ clerkPublishableKey, isDev = false }: SecurityHeaderOptions = {}): string {
  // Fall back to Clerk's shared dev/prod domains if the key isn't available
  // at build time, rather than shipping a CSP that breaks sign-in.
  const clerk = clerkFrontendApiOrigin(clerkPublishableKey) ?? "https://*.clerk.accounts.dev https://*.clerk.com";
  const turnstile = "https://challenges.cloudflare.com";

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : []), clerk, turnstile],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https://img.clerk.com"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", clerk, "https://clerk-telemetry.com", ...(isDev ? ["ws:"] : [])],
    "frame-src": ["'self'", turnstile],
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
    { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  ];
  if (!options.isDev) {
    headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
  }
  return headers;
}
