import { describe, expect, it } from "vitest";
import { missingServerEnv, parseList, requireEnv } from "@/lib/env";

describe("requireEnv", () => {
  it("returns trimmed values", () => {
    expect(requireEnv("DATABASE_URL", { DATABASE_URL: " postgres://x " })).toBe("postgres://x");
  });

  it("throws a descriptive error for missing or blank values", () => {
    expect(() => requireEnv("DATABASE_URL", {})).toThrow(/DATABASE_URL is not set.*\.env\.example/);
    expect(() => requireEnv("CLERK_SECRET_KEY", { CLERK_SECRET_KEY: "  " })).toThrow();
  });
});

describe("missingServerEnv", () => {
  it("lists every missing required variable", () => {
    expect(missingServerEnv({ DATABASE_URL: "x", CLERK_SECRET_KEY: "y" })).toEqual([
      "GOOGLE_GENERATIVE_AI_API_KEY",
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
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
