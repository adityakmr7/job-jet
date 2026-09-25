import { describe, expect, it } from "vitest";
import { assertExtensionEnv, externallyConnectableMatch, validateExtensionEnv } from "../env.config";

describe("validateExtensionEnv", () => {
  it("accepts a valid development config", () => {
    expect(validateExtensionEnv({ VITE_API_BASE_URL: "http://localhost:3001" }, "development")).toEqual({
      errors: [],
      warnings: [],
    });
  });

  it("accepts a valid production config", () => {
    expect(validateExtensionEnv({ VITE_API_BASE_URL: "https://jobjet.example.com" }, "production")).toEqual({
      errors: [],
      warnings: [],
    });
  });

  it("no longer needs a Clerk key, and warns about leftovers", () => {
    const { errors, warnings } = validateExtensionEnv(
      { VITE_API_BASE_URL: "https://jobjet.example.com", VITE_CLERK_PUBLISHABLE_KEY: "pk_live_x" },
      "production"
    );
    expect(errors).toEqual([]);
    expect(warnings[0]).toMatch(/VITE_CLERK_PUBLISHABLE_KEY is no longer used/);
  });

  it("rejects a missing or blank backend URL in any mode", () => {
    expect(validateExtensionEnv({ VITE_API_BASE_URL: "  " }, "development").errors).toContain(
      "VITE_API_BASE_URL is missing or empty."
    );
  });

  it("rejects malformed URLs, non-http schemes and paths", () => {
    const bad = (value: string) => validateExtensionEnv({ VITE_API_BASE_URL: value }, "development").errors;
    expect(bad("jobjet.example.com").some((e) => e.includes("must be an absolute URL"))).toBe(true);
    expect(bad("ftp://x.com").some((e) => e.includes("http(s)"))).toBe(true);
    expect(bad("https://x.com/app").some((e) => e.includes("no path"))).toBe(true);
  });

  it("rejects dev values in production builds", () => {
    const { errors } = validateExtensionEnv({ VITE_API_BASE_URL: "http://localhost:3001" }, "production");
    expect(errors.some((e) => e.includes("local dev server"))).toBe(true);
  });

  it("requires https in production", () => {
    const { errors } = validateExtensionEnv({ VITE_API_BASE_URL: "http://jobjet.example.com" }, "production");
    expect(errors.some((e) => e.includes("https"))).toBe(true);
  });

  it("downgrades production checks to warnings with JOBJET_ALLOW_DEV_CONFIG", () => {
    const result = validateExtensionEnv(
      { VITE_API_BASE_URL: "http://127.0.0.1:3001", JOBJET_ALLOW_DEV_CONFIG: "true" },
      "production"
    );
    expect(result.errors).toEqual([]);
    expect(result.warnings).toHaveLength(1);
  });

  it("the override never bypasses missing values", () => {
    const { errors } = validateExtensionEnv({ JOBJET_ALLOW_DEV_CONFIG: "1" }, "production");
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("assertExtensionEnv", () => {
  it("throws one readable error listing every problem", () => {
    expect(() => assertExtensionEnv({}, "production")).toThrow(/VITE_API_BASE_URL is missing/);
  });
});

describe("externallyConnectableMatch", () => {
  it("limits external messaging to the web app's origin", () => {
    expect(externallyConnectableMatch("https://jobjet.example.com")).toBe("https://jobjet.example.com/*");
    expect(externallyConnectableMatch("http://localhost:3001")).toBe("http://localhost/*");
  });
});
