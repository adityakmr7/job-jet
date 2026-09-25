import { describe, expect, it } from "vitest";
import { frontendApiFromPublishableKey } from "../src/lib/clerk";

describe("frontendApiFromPublishableKey", () => {
  it("decodes the Frontend API host from test and live keys", () => {
    expect(frontendApiFromPublishableKey(`pk_test_${btoa("fast-fox-1.clerk.accounts.dev$")}`)).toBe(
      "fast-fox-1.clerk.accounts.dev"
    );
    expect(frontendApiFromPublishableKey(`pk_live_${btoa("clerk.jobjet.example.com$")}`)).toBe("clerk.jobjet.example.com");
  });
});
