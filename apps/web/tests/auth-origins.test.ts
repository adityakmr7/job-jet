import { describe, expect, it } from "vitest";
import {
  isAllowedExtensionId,
  isCrossSiteMutation,
  resolveTrustedOrigins,
  safeRedirectPath,
  withTrustedAuthorization,
  extensionSessionLabel,
  extensionIdFromSessionLabel,
  isBearerSessionAllowed,
} from "@/lib/auth/origins";
import { buildConnectMessage, isValidConnectState } from "@/lib/auth/extension-connect";

const ID = "abcdefghijklmnopabcdefghijklmnop";
const OTHER = "ponmlkjihgfedcbaponmlkjihgfedcba";
const prod = { allowedExtensionIds: [ID], isProduction: true };

describe("isAllowedExtensionId", () => {
  it("accepts only allowlisted, well-formed IDs", () => {
    expect(isAllowedExtensionId(ID, prod)).toBe(true);
    expect(isAllowedExtensionId(OTHER, prod)).toBe(false);
    expect(isAllowedExtensionId("ABCDEFGHIJKLMNOPABCDEFGHIJKLMNOP", prod)).toBe(false);
    expect(isAllowedExtensionId(`${ID}/x`, prod)).toBe(false);
    expect(isAllowedExtensionId(undefined, prod)).toBe(false);
  });

  it("fails closed in production with no allowlist, open in development", () => {
    expect(isAllowedExtensionId(ID, { allowedExtensionIds: [], isProduction: true })).toBe(false);
    expect(isAllowedExtensionId(ID, { allowedExtensionIds: [], isProduction: false })).toBe(true);
  });
});

describe("resolveTrustedOrigins", () => {
  it("trusts the app origin and each allowlisted extension", () => {
    const origins = resolveTrustedOrigins("https://evil.example", {
      BETTER_AUTH_URL: "https://jobjet.example.com/some/path",
      ALLOWED_EXTENSION_IDS: `${ID}, not-valid`,
      NODE_ENV: "production",
    });
    expect(origins).toEqual(["https://jobjet.example.com", `chrome-extension://${ID}`]);
  });

  it("echoes an unpacked extension's origin only in development with no allowlist", () => {
    const dev = { BETTER_AUTH_URL: "http://localhost:3001", NODE_ENV: "development" };
    expect(resolveTrustedOrigins(`chrome-extension://${OTHER}`, dev)).toContain(`chrome-extension://${OTHER}`);
    expect(resolveTrustedOrigins("https://evil.example", dev)).toEqual(["http://localhost:3001"]);
    expect(resolveTrustedOrigins(`chrome-extension://${OTHER}`, { ...dev, NODE_ENV: "production" })).toEqual([
      "http://localhost:3001",
    ]);
  });
});

describe("withTrustedAuthorization", () => {
  const h = (init: Record<string, string>) => new Headers(init);

  it("keeps Authorization from an allowed extension origin", () => {
    const headers = h({ authorization: "Bearer t", origin: `chrome-extension://${ID}` });
    expect(withTrustedAuthorization(headers, prod).get("authorization")).toBe("Bearer t");
  });

  it("drops Authorization from web pages and other extensions", () => {
    for (const origin of ["https://evil.example", `chrome-extension://${OTHER}`]) {
      const out = withTrustedAuthorization(h({ authorization: "Bearer t", cookie: "a=b", origin }), prod);
      expect(out.get("authorization")).toBeNull();
      expect(out.get("cookie")).toBe("a=b");
    }
  });

  it("keeps Authorization without an Origin (extension GETs); the session binding decides", () => {
    expect(withTrustedAuthorization(h({ authorization: "Bearer t" }), prod).get("authorization")).toBe("Bearer t");
  });
});

describe("isBearerSessionAllowed", () => {
  it("accepts only extension sessions of an allowed extension, from that extension", () => {
    const label = extensionSessionLabel(ID);
    expect(extensionIdFromSessionLabel(label)).toBe(ID);
    expect(isBearerSessionAllowed(label, null, prod)).toBe(true);
    expect(isBearerSessionAllowed(label, `chrome-extension://${ID}`, prod)).toBe(true);
    expect(isBearerSessionAllowed(label, `chrome-extension://${OTHER}`, prod)).toBe(false);
    expect(isBearerSessionAllowed(label, "https://evil.example", prod)).toBe(false);
  });

  it("rejects web sessions and extensions removed from the allowlist", () => {
    expect(isBearerSessionAllowed("Mozilla/5.0 (X11; Linux x86_64)", null, prod)).toBe(false);
    expect(isBearerSessionAllowed(null, null, prod)).toBe(false);
    expect(isBearerSessionAllowed(extensionSessionLabel(OTHER), null, prod)).toBe(false);
    expect(extensionIdFromSessionLabel(`Job Jet extension (${ID}) x`)).toBeNull();
  });
});

describe("isCrossSiteMutation", () => {
  const app = "https://jobjet.example.com";
  it("flags state-changing requests from foreign web origins", () => {
    expect(isCrossSiteMutation("POST", new Headers({ origin: "https://evil.example" }), app)).toBe(true);
    expect(isCrossSiteMutation("DELETE", new Headers({ origin: "https://evil.example" }), app)).toBe(true);
  });
  it("allows same-origin, safe methods, and requests without Origin", () => {
    expect(isCrossSiteMutation("POST", new Headers({ origin: app }), app)).toBe(false);
    expect(isCrossSiteMutation("GET", new Headers({ origin: "https://evil.example" }), app)).toBe(false);
    expect(isCrossSiteMutation("POST", new Headers(), app)).toBe(false);
  });
});

describe("safeRedirectPath", () => {
  it("allows same-site relative paths", () => {
    expect(safeRedirectPath("/dashboard/applications?x=1")).toBe("/dashboard/applications?x=1");
    expect(safeRedirectPath("/extension-connect?ext=a&state=b")).toBe("/extension-connect?ext=a&state=b");
  });
  it("blocks open redirects", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", null, "/a\nb"]) {
      expect(safeRedirectPath(bad)).toBe("/dashboard");
    }
  });
});

describe("extension connect contract", () => {
  it("validates state nonces", () => {
    expect(isValidConnectState("A".repeat(43))).toBe(true);
    expect(isValidConnectState("short")).toBe(false);
    expect(isValidConnectState("A".repeat(40) + "<script>")).toBe(false);
    expect(isValidConnectState(42)).toBe(false);
  });

  it("builds a versioned message", () => {
    const msg = buildConnectMessage({ state: "s", token: "t", expiresAt: "e", user: { email: "a@b.c", name: "A" } });
    expect(msg).toMatchObject({ type: "jobjet:connect", v: 1, state: "s", token: "t" });
  });
});
