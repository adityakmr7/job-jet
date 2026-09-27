import { describe, expect, it } from "vitest";
import type { Profile } from "@job-jet/shared";
import {
  ALLOWED_PROFILE_FIELD_PATHS,
  PROFILE_FIELD_PATH_DESCRIPTIONS,
  customPathsFor,
  resolveProfileFieldPath,
} from "@/lib/field-paths";

const profile: Profile = {
  id: "p1",
  userId: "u1",
  fullName: "Maria de la Cruz",
  email: "maria@example.com",
  phone: "+1 555 0100",
  location: "Austin, TX",
  links: [
    { label: "GitHub", url: "https://github.com/maria" },
    { label: "LinkedIn", url: "https://linkedin.com/in/maria" },
    { label: "Personal website", url: "https://maria.dev" },
  ],
  education: [{ id: "e1", school: "UT Austin", degree: "B.S. CS" }],
  experience: [
    { id: "x1", company: "Acme", title: "Staff Engineer", current: true, bullets: [] },
    { id: "x2", company: "Initech", title: "Engineer", current: false, bullets: [] },
  ],
  skills: [],
  workAuthorization: { authorizedToWork: true, requiresSponsorship: false },
};

describe("resolveProfileFieldPath", () => {
  it.each([
    ["fullName", "Maria de la Cruz"],
    ["firstName", "Maria"],
    ["lastName", "de la Cruz"],
    ["email", "maria@example.com"],
    ["phone", "+1 555 0100"],
    ["location", "Austin, TX"],
    ["linkedin", "https://linkedin.com/in/maria"],
    ["github", "https://github.com/maria"],
    ["portfolio", "https://maria.dev"],
    ["currentCompany", "Acme"],
    ["currentTitle", "Staff Engineer"],
    ["school", "UT Austin"],
    ["degree", "B.S. CS"],
    ["authorizedToWork", "Yes"],
    ["requiresSponsorship", "No"],
  ])("%s -> %s", (path, expected) => {
    expect(resolveProfileFieldPath(profile, path)).toBe(expected);
  });

  it("returns undefined for unknown/hallucinated paths", () => {
    for (const path of ["ssn", "salary", "", "constructor", "toString"]) {
      expect(resolveProfileFieldPath(profile, path)).toBeUndefined();
    }
  });

  it("yearsOfExperience needs dated roles (it used to return the number of roles)", () => {
    expect(resolveProfileFieldPath(profile, "yearsOfExperience")).toBeUndefined();
  });

  it("returns undefined when the profile lacks the data", () => {
    const sparse: Profile = {
      ...profile,
      phone: undefined,
      links: [],
      experience: [],
      education: [],
      workAuthorization: undefined,
    };
    for (const path of [
      "phone",
      "linkedin",
      "portfolio",
      "currentCompany",
      "yearsOfExperience",
      "school",
      "authorizedToWork",
    ]) {
      expect(resolveProfileFieldPath(sparse, path)).toBeUndefined();
    }
  });

  it("falls back to GitHub for portfolio only when no portfolio/website link exists", () => {
    const githubOnly: Profile = { ...profile, links: [profile.links[0]] };
    expect(resolveProfileFieldPath(githubOnly, "portfolio")).toBe("https://github.com/maria");
  });

  it("has a description for every allowed path", () => {
    for (const path of ALLOWED_PROFILE_FIELD_PATHS) {
      expect(PROFILE_FIELD_PATH_DESCRIPTIONS[path]).toBeTruthy();
    }
  });
});

describe("saved answers in the AI tier", () => {
  const withAnswers: Profile = {
    ...profile,
    experience: [{ id: "x1", company: "Acme", title: "Staff Engineer", startDate: "2015-01", current: true, bullets: [] }],
    additionalQuestions: { "open to contract": "Yes" },
    applicationAnswers: {
      referralSource: "LinkedIn",
      noticePeriod: "2 weeks",
      earliestStartDate: "2030-02-01",
      salary: { amount: 150000, currency: "USD", period: "year" },
      willingToRelocate: true,
      workModes: ["remote"],
      yearsOfExperience: 9,
      workAuthorizationByCountry: [{ country: "Canada", authorizedToWork: false, requiresSponsorship: true }],
      pronouns: "she/her",
      demographics: { gender: "Female" },
      customAnswers: [{ id: "c1", question: "Why this team?", answer: "The mission." }],
    },
  };

  it("resolves the new keys from saved answers", () => {
    expect(resolveProfileFieldPath(withAnswers, "referralSource")).toBe("LinkedIn");
    expect(resolveProfileFieldPath(withAnswers, "noticePeriod")).toBe("2 weeks");
    expect(resolveProfileFieldPath(withAnswers, "earliestStartDate", { type: "date" })).toBe("2030-02-01");
    expect(resolveProfileFieldPath(withAnswers, "earliestStartDate", { type: "text" })).toBe("February 1, 2030");
    expect(resolveProfileFieldPath(withAnswers, "salaryExpectation", { label: "Monthly salary expectation" })).toBe("12500 USD");
    expect(resolveProfileFieldPath(withAnswers, "salaryExpectation", { type: "number" })).toBe("150000");
    expect(resolveProfileFieldPath(withAnswers, "willingToRelocate")).toBe("Yes");
    expect(resolveProfileFieldPath(withAnswers, "workMode")).toBe("Remote");
    expect(resolveProfileFieldPath(withAnswers, "yearsOfExperience")).toBe("9");
  });

  it("years of experience without a saved answer is years since the first role, not the role count", () => {
    const p = { ...withAnswers, applicationAnswers: {} };
    expect(Number(resolveProfileFieldPath(p, "yearsOfExperience"))).toBeGreaterThanOrEqual(11);
  });

  it("work authorization follows the country in the label", () => {
    expect(resolveProfileFieldPath(withAnswers, "authorizedToWork", { label: "Can you legally work in Canada?" })).toBe("No");
    expect(resolveProfileFieldPath(withAnswers, "requiresSponsorship", { label: "Need sponsorship in Canada?" })).toBe("Yes");
    expect(resolveProfileFieldPath(withAnswers, "authorizedToWork", { label: "Authorized to work in this country?" })).toBe("Yes");
    expect(resolveProfileFieldPath(withAnswers, "authorizedToWork", { label: "Authorized to work in Germany?" })).toBeUndefined();
  });

  it("custom keys resolve to this user's own answers only", () => {
    const paths = customPathsFor(withAnswers);
    expect(paths).toEqual([
      { path: "custom:c1", question: "Why this team?" },
      { path: "custom:legacy-0", question: "open to contract" },
    ]);
    expect(resolveProfileFieldPath(withAnswers, "custom:c1")).toBe("The mission.");
    expect(resolveProfileFieldPath(withAnswers, "custom:legacy-0")).toBe("Yes");
    expect(resolveProfileFieldPath(withAnswers, "custom:nope")).toBeUndefined();
  });

  it("never offers demographics or pronouns to the model", () => {
    for (const key of ALLOWED_PROFILE_FIELD_PATHS) {
      expect(key).not.toMatch(/gender|pronoun|race|ethnic|veteran|disab|demograph/i);
    }
  });
});
