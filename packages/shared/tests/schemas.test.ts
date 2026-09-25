import { describe, expect, it } from "vitest";
import {
  ApplicationSchema,
  ApplicationStatusSchema,
  DetectedFieldSchema,
  FieldMappingSchema,
  ProfileSchema,
  ResumeContentSchema,
  ResumeSchema,
  computeFieldSignature,
} from "../src";

const minimalProfile = { id: "p1", userId: "u1", fullName: "Priya Sharma", email: "priya@example.com" };

describe("ProfileSchema", () => {
  it("applies defaults for list fields", () => {
    const parsed = ProfileSchema.parse(minimalProfile);
    expect(parsed.links).toEqual([]);
    expect(parsed.education).toEqual([]);
    expect(parsed.experience).toEqual([]);
    expect(parsed.skills).toEqual([]);
  });

  it("defaults work experience flags and bullets", () => {
    const parsed = ProfileSchema.parse({
      ...minimalProfile,
      experience: [{ id: "x1", company: "Nimbus", title: "Engineer" }],
    });
    expect(parsed.experience[0]).toMatchObject({ current: false, bullets: [] });
  });

  it("rejects an invalid email or link URL", () => {
    expect(ProfileSchema.safeParse({ ...minimalProfile, email: "nope" }).success).toBe(false);
    expect(ProfileSchema.safeParse({ ...minimalProfile, links: [{ label: "Site", url: "not a url" }] }).success).toBe(
      false
    );
  });

  it("requires fullName and email", () => {
    const { fullName: _f, ...noName } = minimalProfile;
    expect(ProfileSchema.safeParse(noName).success).toBe(false);
  });

  it("accepts work authorization and additional questions", () => {
    const parsed = ProfileSchema.parse({
      ...minimalProfile,
      workAuthorization: { authorizedToWork: true },
      additionalQuestions: { "why us": "Because." },
    });
    expect(parsed.workAuthorization?.authorizedToWork).toBe(true);
    expect(parsed.additionalQuestions).toEqual({ "why us": "Because." });
  });
});

describe("ResumeContentSchema / ResumeSchema", () => {
  it("is the profile's resume-relevant subset (drops ids and workAuthorization)", () => {
    const parsed = ResumeContentSchema.parse({ ...minimalProfile, workAuthorization: { authorizedToWork: true } });
    expect(parsed).not.toHaveProperty("id");
    expect(parsed).not.toHaveProperty("userId");
    expect(parsed).not.toHaveProperty("workAuthorization");
    expect(parsed.fullName).toBe("Priya Sharma");
  });

  it("validates a tailored resume record", () => {
    const resume = {
      id: "r1",
      userId: "u1",
      kind: "ai_tailored",
      fileName: "Priya.pdf",
      blobUrl: "https://blob.example.com/r1.pdf",
      content: { fullName: "Priya Sharma", email: "priya@example.com" },
      tailoredFor: { jobDescription: "Build things" },
      createdAt: "2026-01-01T00:00:00Z",
    };
    expect(ResumeSchema.safeParse(resume).success).toBe(true);
    expect(ResumeSchema.safeParse({ ...resume, kind: "other" }).success).toBe(false);
    expect(ResumeSchema.safeParse({ ...resume, tailoredFor: {} }).success).toBe(false);
  });
});

describe("ApplicationSchema", () => {
  const app = {
    id: "a1",
    userId: "u1",
    url: "https://jobs.lever.co/acme/1",
    domain: "jobs.lever.co",
    status: "draft",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  it("accepts every status in the lifecycle", () => {
    for (const status of ["detected", "draft", "applied", "interviewing", "rejected", "offer"]) {
      expect(ApplicationStatusSchema.safeParse(status).success).toBe(true);
    }
    expect(ApplicationSchema.safeParse(app).success).toBe(true);
  });

  it("rejects unknown statuses and invalid URLs", () => {
    expect(ApplicationSchema.safeParse({ ...app, status: "ghosted" }).success).toBe(false);
    expect(ApplicationSchema.safeParse({ ...app, url: "jobs.lever.co" }).success).toBe(false);
  });
});

describe("DetectedFieldSchema / FieldMappingSchema", () => {
  it("requires selector and type", () => {
    expect(DetectedFieldSchema.safeParse({ selector: "[data-jobjet-id='jj-0']", type: "text" }).success).toBe(true);
    expect(DetectedFieldSchema.safeParse({ selector: "x" }).success).toBe(false);
  });

  it("bounds confidence to 0..1 and defaults hitCount", () => {
    const base = {
      id: "m1",
      domain: "jobs.lever.co",
      fieldSignature: "linkedin profile::text",
      profileFieldPath: "linkedin",
      confidence: 0.7,
      source: "llm",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    expect(FieldMappingSchema.parse(base).hitCount).toBe(0);
    expect(FieldMappingSchema.safeParse({ ...base, confidence: 1.5 }).success).toBe(false);
    expect(FieldMappingSchema.safeParse({ ...base, source: "guess" }).success).toBe(false);
  });
});

describe("computeFieldSignature", () => {
  it("normalizes label text: case, asterisks, punctuation, whitespace", () => {
    expect(computeFieldSignature({ label: "  LinkedIn   Profile* ", type: "text" })).toBe("linkedin profile::text");
    expect(computeFieldSignature({ label: "Are you authorized to work in the U.S.?", type: "select" })).toBe(
      "are you authorized to work in the u s::select"
    );
  });

  it("prefers label, then placeholder, then name, then id", () => {
    expect(computeFieldSignature({ label: "Email", placeholder: "p", name: "n", id: "i", type: "email" })).toBe(
      "email::email"
    );
    expect(computeFieldSignature({ placeholder: "Your email", name: "n", type: "email" })).toBe("your email::email");
    expect(computeFieldSignature({ name: "question_123", id: "i", type: "text" })).toBe("question 123::text");
    expect(computeFieldSignature({ id: "only-id", type: "text" })).toBe("only id::text");
  });

  it("is stable across per-posting random ids when labels match", () => {
    const a = computeFieldSignature({ label: "LinkedIn Profile", id: "question_1", type: "text" });
    const b = computeFieldSignature({ label: "LinkedIn Profile", id: "question_2", type: "text" });
    expect(a).toBe(b);
  });

  it("includes the input type so different controls don't collide", () => {
    expect(computeFieldSignature({ label: "Phone", type: "tel" })).not.toBe(
      computeFieldSignature({ label: "Phone", type: "text" })
    );
  });

  it("handles fields with no descriptive text", () => {
    expect(computeFieldSignature({ type: "text" })).toBe("::text");
  });
});
