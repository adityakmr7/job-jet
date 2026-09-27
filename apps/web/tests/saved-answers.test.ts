import { describe, expect, it } from "vitest";
import { mergeCustomAnswers } from "@/lib/saved-answers";
import { ProfileInputSchema, SaveAnswersRequestSchema } from "@/lib/validation";

describe("mergeCustomAnswers", () => {
  let n = 0;
  const id = () => `n${++n}`;
  it("replaces the answer for the same question and appends new ones", () => {
    const merged = mergeCustomAnswers(
      [{ id: "a", question: "Open to contract roles?", answer: "No" }],
      [
        { question: "open to contract roles", answer: "Yes" },
        { question: "Preferred team", answer: "Platform" },
      ],
      id
    );
    expect(merged).toEqual([
      { id: "a", question: "Open to contract roles?", answer: "Yes" },
      { id: "n1", question: "Preferred team", answer: "Platform" },
    ]);
  });
  it("refuses to go over 50", () => {
    const existing = Array.from({ length: 50 }, (_, i) => ({ id: `${i}`, question: `q${i}`, answer: "a" }));
    expect(mergeCustomAnswers(existing, [{ question: "new", answer: "x" }], id)).toBeNull();
    expect(mergeCustomAnswers(existing, [{ question: "q3", answer: "x" }], id)).not.toBeNull();
  });
});

describe("SaveAnswersRequestSchema", () => {
  it("sanitizes and bounds input", () => {
    const ok = SaveAnswersRequestSchema.parse({ answers: [{ question: " Q\u0007 ", answer: " A " }] });
    expect(ok.answers[0]).toEqual({ question: "Q", answer: "A" });
    expect(SaveAnswersRequestSchema.safeParse({ answers: [] }).success).toBe(false);
    expect(SaveAnswersRequestSchema.safeParse({ answers: [{ question: "", answer: "x" }] }).success).toBe(false);
    expect(SaveAnswersRequestSchema.safeParse({ answers: [{ question: "q", answer: "x".repeat(2001) }] }).success).toBe(
      false
    );
    const many = Array.from({ length: 21 }, () => ({ question: "q", answer: "a" }));
    expect(SaveAnswersRequestSchema.safeParse({ answers: many }).success).toBe(false);
  });
});

describe("PUT /api/profile body with saved answers", () => {
  const base = { fullName: "A", email: "a@example.com" };
  it("accepts and sanitizes applicationAnswers", () => {
    const parsed = ProfileInputSchema.parse({
      ...base,
      applicationAnswers: {
        noticePeriod: " 2 weeks ",
        workModes: ["remote"],
        salary: { amount: 5, currency: "eur", period: "month" },
      },
    });
    expect(parsed.applicationAnswers).toEqual({
      noticePeriod: "2 weeks",
      workModes: ["remote"],
      salary: { amount: 5, currency: "EUR", period: "month" },
    });
  });
  it("rejects invalid saved answers", () => {
    expect(ProfileInputSchema.safeParse({ ...base, applicationAnswers: { workModes: ["mars"] } }).success).toBe(false);
    expect(ProfileInputSchema.safeParse({ ...base, applicationAnswers: { pronouns: "x".repeat(41) } }).success).toBe(
      false
    );
  });
  it("still accepts a profile without them (older clients)", () => {
    expect(ProfileInputSchema.parse(base).applicationAnswers).toBeUndefined();
  });
});
