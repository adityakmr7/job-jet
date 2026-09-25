import { describe, expect, it } from "vitest";
import {
  isEmailProviderConfigured,
  isGoogleAuthConfigured,
  missingServerEnv,
  parseList,
  requireEnv,
} from "@/lib/env";

describe("requireEnv", () => {
  it("returns trimmed values", () => {
    expect(requireEnv("DATABASE_URL", { DATABASE_URL: " postgres://x " })).toBe("postgres://x");
  });

  it("throws a descriptive error for missing or blank values", () => {
    expect(() => requireEnv("DATABASE_URL", {})).toThrow(/DATABASE_URL is not set.*\.env\.example/);
    expect(() => requireEnv("BETTER_AUTH_SECRET", { BETTER_AUTH_SECRET: "  " })).toThrow();
  });
});

describe("missingServerEnv", () => {
  it("lists every missing required variable", () => {
    expect(missingServerEnv({ DATABASE_URL: "x", BETTER_AUTH_SECRET: "y" })).toEqual([
      "GOOGLE_GENERATIVE_AI_API_KEY",
      "BETTER_AUTH_URL",
      "BLOB_READ_WRITE_TOKEN",
    ]);
  });
});

describe("parseList", () => {
  it("splits on commas and whitespace, dropping empties", () => {
    expect(parseList(" a, b ,,c\nd ")).toEqual(["a", "b", "c", "d"]);
    expect(parseList(undefined)).toEqual([]);
    expect(parseList("")).toEqual([]);
  });
});

describe("optional auth providers", () => {
  it("enables Google only when both credentials are set", () => {
    expect(isGoogleAuthConfigured({ GOOGLE_CLIENT_ID: "id" })).toBe(false);
    expect(isGoogleAuthConfigured({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: " " })).toBe(false);
    expect(isGoogleAuthConfigured({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" })).toBe(true);
  });

  it("treats RESEND_API_KEY as the email provider switch", () => {
    expect(isEmailProviderConfigured({})).toBe(false);
    expect(isEmailProviderConfigured({ RESEND_API_KEY: "re_x" })).toBe(true);
  });
});
