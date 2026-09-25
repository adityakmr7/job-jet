import { describe, expect, it } from "vitest";
import {
  ApplicationPatchSchema,
  ApplicationUpsertSchema,
  AutofillMapRequestSchema,
  LIMITS,
  TailorRequestSchema,
  isMappingCompatible,
  normalizeSiteKey,
  validationErrorBody,
} from "@/lib/validation";

const UUID = "3f2b8c1e-4d5a-4e6f-8a7b-9c0d1e2f3a4b";

describe("TailorRequestSchema", () => {
  it("trims and accepts a job description with optional title/company", () => {
    const parsed = TailorRequestSchema.parse({ jobDescription: "  Build things  ", jobTitle: "Engineer" });
    expect(parsed).toEqual({ jobDescription: "Build things", jobTitle: "Engineer" });
  });

  it("rejects missing, blank, or oversized job descriptions", () => {
    expect(TailorRequestSchema.safeParse({}).success).toBe(false);
    expect(TailorRequestSchema.safeParse({ jobDescription: "   " }).success).toBe(false);
    expect(TailorRequestSchema.safeParse({ jobDescription: "x".repeat(LIMITS.jobDescription + 1) }).success).toBe(
      false
    );
    expect(
      TailorRequestSchema.safeParse({ jobDescription: "ok", company: "x".repeat(LIMITS.shortText + 1) }).success
    ).toBe(false);
  });
});

describe("AutofillMapRequestSchema", () => {
  const field = { selector: "[data-jobjet-id='jj-1']", type: "text", label: "LinkedIn" };

  it("accepts a well-formed request", () => {
    expect(AutofillMapRequestSchema.safeParse({ domain: "jobs.lever.co", fields: [field] }).success).toBe(true);
  });

  it("rejects too many fields, oversized labels/options, and missing selector/type", () => {
    const many = Array.from({ length: LIMITS.autofillFields + 1 }, () => field);
    expect(AutofillMapRequestSchema.safeParse({ domain: "a.com", fields: many }).success).toBe(false);
    expect(
      AutofillMapRequestSchema.safeParse({
        domain: "a.com",
        fields: [{ ...field, label: "x".repeat(LIMITS.fieldLabel + 1) }],
      }).success
    ).toBe(false);
    expect(
      AutofillMapRequestSchema.safeParse({
        domain: "a.com",
        fields: [{ ...field, options: Array.from({ length: LIMITS.fieldOptions + 1 }, () => "o") }],
      }).success
    ).toBe(false);
    expect(AutofillMapRequestSchema.safeParse({ domain: "a.com", fields: [{ type: "text" }] }).success).toBe(false);
    expect(AutofillMapRequestSchema.safeParse({ domain: "a.com", fields: [{ selector: "s" }] }).success).toBe(false);
  });
});

describe("Application schemas", () => {
  it("upsert: requires url, validates resumeId and status", () => {
    expect(
      ApplicationUpsertSchema.safeParse({ url: "https://x.com/job", resumeId: UUID, status: "draft" }).success
    ).toBe(true);
    expect(ApplicationUpsertSchema.safeParse({}).success).toBe(false);
    expect(ApplicationUpsertSchema.safeParse({ url: "https://x.com", resumeId: "123" }).success).toBe(false);
    expect(ApplicationUpsertSchema.safeParse({ url: "https://x.com", status: "hired" }).success).toBe(false);
  });

  it("patch: allows null to clear fields, validates types and lengths", () => {
    expect(ApplicationPatchSchema.parse({ resumeId: null, notes: null })).toEqual({ resumeId: null, notes: null });
    expect(ApplicationPatchSchema.safeParse({ status: "offer", notes: "Great call" }).success).toBe(true);
    expect(ApplicationPatchSchema.safeParse({ status: "nope" }).success).toBe(false);
    expect(ApplicationPatchSchema.safeParse({ resumeId: "not-a-uuid" }).success).toBe(false);
    expect(ApplicationPatchSchema.safeParse({ notes: 42 }).success).toBe(false);
    expect(ApplicationPatchSchema.safeParse({ notes: "x".repeat(LIMITS.notes + 1) }).success).toBe(false);
  });

  it("patch: strips unknown keys (e.g. userId) instead of passing them to the DB", () => {
    expect(ApplicationPatchSchema.parse({ userId: "someone-else", id: UUID, notes: "hi" })).toEqual({ notes: "hi" });
  });
});

describe("normalizeSiteKey", () => {
  it("lowercases hostnames and extracts them from URLs", () => {
    expect(normalizeSiteKey("Jobs.Lever.co")).toBe("jobs.lever.co");
    expect(normalizeSiteKey("https://boards.greenhouse.io/acme/jobs/1?x=1#y")).toBe("boards.greenhouse.io");
    expect(normalizeSiteKey("jobs.ashbyhq.com.")).toBe("jobs.ashbyhq.com");
  });

  it("rejects non-hostnames and non-web schemes", () => {
    for (const bad of [
      "",
      "   ",
      "localhost",
      "not a domain",
      "javascript:alert(1)",
      "ftp://files.example.com",
      "[::1]",
      "a".repeat(3000),
    ]) {
      expect(normalizeSiteKey(bad)).toBeNull();
    }
  });

  it("drops path/credential tricks, keeping only the real host", () => {
    expect(normalizeSiteKey("https://user:pass@jobs.lever.co/x")).toBe("jobs.lever.co");
    expect(normalizeSiteKey("jobs.lever.co/../../etc")).toBe("jobs.lever.co");
  });
});

describe("isMappingCompatible", () => {
  it("rejects paths outside the allow-list", () => {
    expect(isMappingCompatible("ssn", { type: "text" })).toBe(false);
    expect(isMappingCompatible("__proto__", { type: "text" })).toBe(false);
  });

  it("never fills file, checkbox, password or date inputs", () => {
    for (const type of ["file", "checkbox", "radio", "password", "date", "hidden"]) {
      expect(isMappingCompatible("fullName", { type })).toBe(false);
    }
  });

  it("enforces type-specific paths", () => {
    expect(isMappingCompatible("email", { type: "email" })).toBe(true);
    expect(isMappingCompatible("phone", { type: "email" })).toBe(false);
    expect(isMappingCompatible("phone", { type: "tel" })).toBe(true);
    expect(isMappingCompatible("email", { type: "tel" })).toBe(false);
    expect(isMappingCompatible("linkedin", { type: "url" })).toBe(true);
    expect(isMappingCompatible("fullName", { type: "url" })).toBe(false);
    expect(isMappingCompatible("yearsOfExperience", { type: "number" })).toBe(true);
    expect(isMappingCompatible("school", { type: "number" })).toBe(false);
  });

  it("allows any allow-listed path for text, textarea and select", () => {
    for (const type of ["text", "textarea", "select", "TEXT"]) {
      expect(isMappingCompatible("authorizedToWork", { type })).toBe(true);
    }
  });
});

describe("validationErrorBody", () => {
  it("surfaces a single issue's message directly, with paths", () => {
    const result = TailorRequestSchema.safeParse({ jobDescription: "" });
    expect(result.success).toBe(false);
    const body = validationErrorBody(result.error!);
    expect(body.error).toBe("Missing jobDescription");
    expect(body.issues).toEqual([{ path: "jobDescription", message: "Missing jobDescription" }]);
  });

  it("uses a generic message for multiple issues", () => {
    const result = ApplicationPatchSchema.safeParse({ status: "x", resumeId: "y" });
    expect(validationErrorBody(result.error!).error).toBe("Invalid request");
  });
});

describe("ProfileInputSchema links", () => {
  const base = { fullName: "Priya", email: "priya@example.com" };
  it("accepts http(s) links", async () => {
    const { ProfileInputSchema } = await import("@/lib/validation");
    expect(ProfileInputSchema.safeParse({ ...base, links: [{ label: "GitHub", url: "https://github.com/p" }] }).success).toBe(true);
  });
  it("rejects javascript: and data: links", async () => {
    const { ProfileInputSchema, isHttpUrl } = await import("@/lib/validation");
    expect(ProfileInputSchema.safeParse({ ...base, links: [{ label: "x", url: "javascript:alert(1)" }] }).success).toBe(false);
    expect(isHttpUrl("data:text/html,hi")).toBe(false);
    expect(isHttpUrl("not a url")).toBe(false);
  });
});
