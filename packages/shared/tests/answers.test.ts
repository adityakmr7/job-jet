import { describe, expect, it } from "vitest";
import {
  ApplicationAnswersSchema,
  ProfileSchema,
  allCustomAnswers,
  canonicalCountry,
  detectCountries,
  findCustomAnswer,
  formatStartDate,
  matchNoticeOption,
  noticePeriodDays,
  salaryAnswer,
  workAuthFor,
  yearsOfExperienceFor,
} from "../src";

describe("detectCountries", () => {
  it("finds countries in order and tells the US from the pronoun 'us'", () => {
    expect(detectCountries("Are you legally authorized to work in the United States?")).toEqual(["United States"]);
    expect(detectCountries("Are you currently located in the US?")).toEqual(["United States"]);
    expect(detectCountries("Tell us why you want to join us")).toEqual([]);
    expect(detectCountries("How did you hear about us?")).toEqual([]);
    expect(detectCountries("Do you have the unrestricted right to work in Canada?")).toEqual(["Canada"]);
    expect(detectCountries("Are you legally authorized to work in Poland")).toEqual(["Poland"]);
    expect(detectCountries("Right to work in the UK or India?")).toEqual(["United Kingdom", "India"]);
    expect(detectCountries("the country where the job is located")).toEqual([]);
  });

  it("canonicalizes what users type", () => {
    expect(canonicalCountry("usa")).toBe("United States");
    expect(canonicalCountry(" UK ")).toBe("United Kingdom");
    expect(canonicalCountry("poland")).toBe("Poland");
    expect(canonicalCountry("Atlantis")).toBe("Atlantis");
  });
});

describe("workAuthFor", () => {
  const defaults = { authorizedToWork: true, requiresSponsorship: false };
  const list = [
    { country: "Canada", authorizedToWork: false, requiresSponsorship: true },
    { country: "usa", authorizedToWork: true, requiresSponsorship: false },
  ];
  it("uses the entry for the named country", () => {
    expect(workAuthFor("right to work in Canada?", defaults, list)).toEqual({
      authorizedToWork: false,
      requiresSponsorship: true,
    });
    expect(workAuthFor("authorized to work in the United States?", defaults, list)?.authorizedToWork).toBe(true);
  });
  it("falls back to the default only when no country is named", () => {
    expect(workAuthFor("authorized to work in the country where the job is located?", defaults, list)).toBe(defaults);
  });
  it("gives nothing for a named country without an entry", () => {
    expect(workAuthFor("authorized to work in Germany?", defaults, list)).toBeUndefined();
  });
  it("keeps the old behaviour when there is no per-country list", () => {
    expect(workAuthFor("authorized to work in Germany?", defaults, undefined)).toBe(defaults);
    expect(workAuthFor("authorized to work in Germany?", defaults, [])).toBe(defaults);
  });
});

describe("notice period, start date, salary, years", () => {
  it("reads notice periods", () => {
    expect(noticePeriodDays("Immediately")).toBe(0);
    expect(noticePeriodDays("2 weeks")).toBe(14);
    expect(noticePeriodDays("one month")).toBe(30);
    expect(noticePeriodDays("3 months")).toBe(90);
    expect(noticePeriodDays("whenever")).toBeUndefined();
    expect(matchNoticeOption(["Select...", "Immediate", "2 weeks", "1 month", "2 months"], "30 days")).toBe("1 month");
    expect(matchNoticeOption(["1 month", "4 weeks"], "1 month")).toBe("1 month");
  });

  it("formats start dates", () => {
    expect(formatStartDate("2026-11-02", "iso")).toBe("2026-11-02");
    expect(formatStartDate("2026-11-02", "us")).toBe("11/02/2026");
    expect(formatStartDate("2026-11-02", "text")).toBe("November 2, 2026");
    expect(formatStartDate("bad", "us")).toBeUndefined();
  });

  it("converts salary periods only between year and month", () => {
    const yearly = { amount: 120000, currency: "EUR", period: "year" as const };
    expect(salaryAnswer(yearly, "Desired salary")).toBe("120000 EUR per year");
    expect(salaryAnswer(yearly, "Expected monthly salary")).toBe("10000 EUR");
    expect(salaryAnswer(yearly, "Expected monthly salary, numbers only")).toBe("10000");
    expect(salaryAnswer(yearly, "Salary", { numericOnly: true })).toBe("120000");
    expect(salaryAnswer(yearly, "Hourly rate")).toBeUndefined();
    expect(salaryAnswer({ amount: 5000, currency: "PLN", period: "month" }, "Annual salary expectation")).toBe(
      "60000 PLN"
    );
  });

  it("years of experience: saved answer wins, else since the first dated role", () => {
    const now = new Date("2026-09-27");
    expect(yearsOfExperienceFor([{ startDate: "2019-04" }], 3, now)).toBe("3");
    expect(yearsOfExperienceFor([{ startDate: "2019-04" }, { startDate: "2021" }], undefined, now)).toBe("7");
    expect(yearsOfExperienceFor([{}], undefined, now)).toBeUndefined();
  });
});

describe("custom answers", () => {
  const answers = [
    { id: "1", question: "open to contract", answer: "Yes" },
    { id: "2", question: "Are you open to contract roles in Europe", answer: "No" },
  ];
  it("matches when every meaningful word of the saved question appears", () => {
    expect(findCustomAnswer("Are you open to contract work?", answers)?.id).toBe("1");
    expect(findCustomAnswer("Would you be open to contract roles in Europe?", answers)?.id).toBe("2");
    expect(findCustomAnswer("What is your notice period?", answers)).toBeUndefined();
  });
  it("includes legacy additionalQuestions after saved ones", () => {
    const all = allCustomAnswers({ customAnswers: [answers[0]] }, { "why us": "Because.", "": "x" });
    expect(all.map((a) => a.question)).toEqual(["open to contract", "why us"]);
  });
});

describe("ApplicationAnswersSchema", () => {
  it("sanitizes text and normalizes the currency", () => {
    const parsed = ApplicationAnswersSchema.parse({
      referralSource: "  Linked\u0000In  ",
      salary: { amount: 100, currency: " usd ", period: "year" },
      customAnswers: [{ id: "a", question: " Q? ", answer: "line1\nline2 " }],
      earliestStartDate: "",
    });
    expect(parsed.referralSource).toBe("LinkedIn");
    expect(parsed.salary?.currency).toBe("USD");
    expect(parsed.customAnswers?.[0]).toEqual({ id: "a", question: "Q?", answer: "line1\nline2" });
    expect(parsed.earliestStartDate).toBeUndefined();
  });

  it("rejects bad values and oversized lists", () => {
    const bad = (v: unknown) => ApplicationAnswersSchema.safeParse(v).success;
    expect(bad({ salary: { amount: -1, currency: "USD", period: "year" } })).toBe(false);
    expect(bad({ salary: { amount: 1, currency: "dollars", period: "year" } })).toBe(false);
    expect(bad({ workModes: ["space"] })).toBe(false);
    expect(bad({ earliestStartDate: "next week" })).toBe(false);
    expect(bad({ yearsOfExperience: 200 })).toBe(false);
    expect(bad({ referralSource: "x".repeat(201) })).toBe(false);
    expect(bad({ customAnswers: [{ id: "a", question: "   ", answer: "x" }] })).toBe(false);
    expect(
      bad({ customAnswers: Array.from({ length: 51 }, (_, i) => ({ id: `${i}`, question: "q", answer: "a" })) })
    ).toBe(false);
    expect(bad({ workAuthorizationByCountry: Array.from({ length: 31 }, () => ({ country: "X" })) })).toBe(false);
  });

  it("is optional on the profile (older profiles still parse)", () => {
    const base = { id: "p", userId: "u", fullName: "A", email: "a@example.com" };
    expect(ProfileSchema.parse(base).applicationAnswers).toBeUndefined();
    expect(
      ProfileSchema.parse({ ...base, applicationAnswers: { pronouns: "they/them" } }).applicationAnswers?.pronouns
    ).toBe("they/them");
  });
});
