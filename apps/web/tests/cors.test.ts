import { describe, expect, it, vi } from "vitest";
import { corsConfigFromEnv, corsHeaders, isAllowedExtensionOrigin } from "@/lib/cors";

const ID_A = "abcdefghijklmnopabcdefghijklmnop";
const ID_B = "ponmlkjihgfedcbaponmlkjihgfedcba";
const originA = `chrome-extension://${ID_A}`;
const originB = `chrome-extension://${ID_B}`;

const allowOrigin = (h: HeadersInit) => (h as Record<string, string>)["Access-Control-Allow-Origin"];

describe("corsConfigFromEnv", () => {
  it("parses comma/space separated extension ids", () => {
    expect(corsConfigFromEnv({ ALLOWED_EXTENSION_IDS: ` ${ID_A}, ${ID_B} `, NODE_ENV: "production" })).toEqual({
      allowedExtensionIds: [ID_A, ID_B],
      isProduction: true,
    });
    expect(corsConfigFromEnv({ NODE_ENV: "development" })).toEqual({
      allowedExtensionIds: [],
      isProduction: false,
    });
  });
});

describe("isAllowedExtensionOrigin", () => {
  it("only reflects listed extension ids when a list is configured", () => {
    const config = { allowedExtensionIds: [ID_A], isProduction: true };
    expect(isAllowedExtensionOrigin(originA, config)).toBe(true);
    expect(isAllowedExtensionOrigin(originB, config)).toBe(false);
  });

  it("allows any extension in development when no list is configured", () => {
    expect(isAllowedExtensionOrigin(originB, { allowedExtensionIds: [], isProduction: false })).toBe(true);
  });

  it("fails closed in production when no list is configured", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(isAllowedExtensionOrigin(originA, { allowedExtensionIds: [], isProduction: true })).toBe(false);
    warn.mockRestore();
  });

  it("never allows web origins, malformed extension origins, or null", () => {
    const config = { allowedExtensionIds: [], isProduction: false };
    expect(isAllowedExtensionOrigin("https://evil.example.com", config)).toBe(false);
    expect(isAllowedExtensionOrigin(`chrome-extension://${ID_A}.evil.com`, config)).toBe(false);
    expect(isAllowedExtensionOrigin("chrome-extension://short", config)).toBe(false);
    expect(isAllowedExtensionOrigin(null, config)).toBe(false);
  });
});

describe("corsHeaders", () => {
  it("sets Allow-Origin only for allowed origins and always varies on Origin", () => {
    const config = { allowedExtensionIds: [ID_A], isProduction: true };
    const ok = corsHeaders(originA, config) as Record<string, string>;
    expect(allowOrigin(ok)).toBe(originA);
    expect(ok.Vary).toBe("Origin");
    expect(ok["Access-Control-Allow-Headers"]).toContain("Authorization");

    const denied = corsHeaders(originB, config) as Record<string, string>;
    expect(allowOrigin(denied)).toBeUndefined();
    expect(denied.Vary).toBe("Origin");
  });

  it("never returns a wildcard", () => {
    const h = corsHeaders("*", { allowedExtensionIds: [], isProduction: false });
    expect(allowOrigin(h)).toBeUndefined();
  });
});
