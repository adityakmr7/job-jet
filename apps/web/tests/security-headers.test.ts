import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, buildSecurityHeaders, clerkFrontendApiOrigin } from "@/lib/security-headers";

const key = (host: string, env = "live") => `pk_${env}_${Buffer.from(`${host}$`).toString("base64")}`;

describe("clerkFrontendApiOrigin", () => {
  it("decodes the Frontend API host from a publishable key", () => {
    expect(clerkFrontendApiOrigin(key("clerk.jobjet.example.com"))).toBe("https://clerk.jobjet.example.com");
    expect(clerkFrontendApiOrigin(key("fun-cat-12.clerk.accounts.dev", "test"))).toBe(
      "https://fun-cat-12.clerk.accounts.dev"
    );
  });

  it("rejects malformed keys", () => {
    expect(clerkFrontendApiOrigin(undefined)).toBeNull();
    expect(clerkFrontendApiOrigin("sk_live_abc")).toBeNull();
    expect(clerkFrontendApiOrigin(`pk_live_${Buffer.from("evil.com; script-src *$").toString("base64")}`)).toBeNull();
  });
});

describe("buildContentSecurityPolicy", () => {
  it("allows only self + the app's Clerk instance for scripts and connections", () => {
    const csp = buildContentSecurityPolicy({ clerkPublishableKey: key("clerk.jobjet.example.com") });
    expect(csp).toContain("script-src 'self' 'unsafe-inline' https://clerk.jobjet.example.com");
    expect(csp).toContain("connect-src 'self' https://clerk.jobjet.example.com");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("adds unsafe-eval and websockets only in development", () => {
    const csp = buildContentSecurityPolicy({ isDev: true });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("ws:");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("falls back to Clerk's shared domains when the key is missing", () => {
    expect(buildContentSecurityPolicy()).toContain("https://*.clerk.accounts.dev");
  });
});

describe("buildSecurityHeaders", () => {
  it("sets anti-framing, nosniff, referrer and HSTS headers in production", () => {
    const headers = Object.fromEntries(buildSecurityHeaders().map((h) => [h.key, h.value]));
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Strict-Transport-Security"]).toMatch(/max-age=\d+/);
  });

  it("omits HSTS in development", () => {
    expect(buildSecurityHeaders({ isDev: true }).some((h) => h.key === "Strict-Transport-Security")).toBe(false);
  });
});
