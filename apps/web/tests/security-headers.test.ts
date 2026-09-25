import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, buildSecurityHeaders } from "@/lib/security-headers";

describe("buildContentSecurityPolicy", () => {
  it("limits scripts and connections to the app's own origin", () => {
    const csp = buildContentSecurityPolicy();
    expect(csp).toContain("script-src 'self' 'unsafe-inline';");
    expect(csp).toContain("connect-src 'self';");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("no longer references any third-party auth provider", () => {
    const csp = buildContentSecurityPolicy();
    expect(csp).not.toMatch(/clerk|challenges\.cloudflare\.com/);
  });

  it("adds unsafe-eval and websockets only in development", () => {
    const csp = buildContentSecurityPolicy({ isDev: true });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("ws:");
    expect(csp).not.toContain("upgrade-insecure-requests");
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
