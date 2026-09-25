import { describe, expect, it } from "vitest";
import { assertExtensionEnv, validateExtensionEnv } from "../env.config";

const liveKey = `pk_live_${btoa("clerk.jobjet.example.com$")}`;
const testKey = `pk_test_${btoa("fast-fox-1.clerk.accounts.dev$")}`;

describe("validateExtensionEnv", () => {
  it("accepts a valid development config", () => {
    expect(
      validateExtensionEnv(
        { VITE_CLERK_PUBLISHABLE_KEY: testKey, VITE_CLERK_SYNC_HOST: "http://localhost:3001" },
        "development"
      )
    ).toEqual({ errors: [], warnings: [] });
  });

  it("accepts a valid production config", () => {
    expect(
      validateExtensionEnv(
        { VITE_CLERK_PUBLISHABLE_KEY: liveKey, VITE_CLERK_SYNC_HOST: "https://jobjet.example.com" },
        "production"
      )
    ).toEqual({ errors: [], warnings: [] });
  });

  it("rejects missing or blank required vars in any mode", () => {
    const { errors } = validateExtensionEnv({ VITE_CLERK_PUBLISHABLE_KEY: "  " }, "development");
    expect(errors).toContain("VITE_CLERK_PUBLISHABLE_KEY is missing or empty.");
    expect(errors).toContain("VITE_CLERK_SYNC_HOST is missing or empty.");
  });

  it("rejects malformed keys and URLs", () => {
    const { errors } = validateExtensionEnv(
      { VITE_CLERK_PUBLISHABLE_KEY: "sk_live_secret", VITE_CLERK_SYNC_HOST: "jobjet.example.com" },
      "development"
    );
    expect(errors.some((e) => e.includes("doesn't look like a Clerk publishable key"))).toBe(true);
    expect(errors.some((e) => e.includes("must be an absolute URL"))).toBe(true);

    const undecodable = validateExtensionEnv(
      { VITE_CLERK_PUBLISHABLE_KEY: "pk_test_x", VITE_CLERK_SYNC_HOST: "http://localhost:3001" },
      "development"
    );
    expect(undecodable.errors.some((e) => e.includes("malformed"))).toBe(true);

    const ftp = validateExtensionEnv(
      { VITE_CLERK_PUBLISHABLE_KEY: testKey, VITE_CLERK_SYNC_HOST: "ftp://x.com" },
      "development"
    );
    expect(ftp.errors.some((e) => e.includes("http(s)"))).toBe(true);
  });

  it("rejects dev values in production builds", () => {
    const { errors } = validateExtensionEnv(
      { VITE_CLERK_PUBLISHABLE_KEY: testKey, VITE_CLERK_SYNC_HOST: "http://localhost:3001" },
      "production"
    );
    expect(errors.some((e) => e.includes("local dev server"))).toBe(true);
    expect(errors.some((e) => e.includes("pk_test_"))).toBe(true);
  });

  it("requires https in production", () => {
    const { errors } = validateExtensionEnv(
      { VITE_CLERK_PUBLISHABLE_KEY: liveKey, VITE_CLERK_SYNC_HOST: "http://jobjet.example.com" },
      "production"
    );
    expect(errors.some((e) => e.includes("https"))).toBe(true);
  });

  it("downgrades production checks to warnings with JOBJET_ALLOW_DEV_CONFIG", () => {
    const result = validateExtensionEnv(
      {
        VITE_CLERK_PUBLISHABLE_KEY: testKey,
        VITE_CLERK_SYNC_HOST: "http://127.0.0.1:3001",
        JOBJET_ALLOW_DEV_CONFIG: "true",
      },
      "production"
    );
    expect(result.errors).toEqual([]);
    expect(result.warnings).toHaveLength(2);
  });

  it("the override never bypasses missing values", () => {
    const { errors } = validateExtensionEnv({ JOBJET_ALLOW_DEV_CONFIG: "1" }, "production");
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("assertExtensionEnv", () => {
  it("throws one readable error listing every problem", () => {
    expect(() => assertExtensionEnv({}, "production")).toThrow(
      /VITE_CLERK_PUBLISHABLE_KEY is missing[\s\S]*VITE_CLERK_SYNC_HOST is missing/
    );
  });
});
