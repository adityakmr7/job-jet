import { describe, expect, it } from "vitest";
import type { Profile } from "@job-jet/shared";
import { ALLOWED_PROFILE_FIELD_PATHS, PROFILE_FIELD_PATH_DESCRIPTIONS, resolveProfileFieldPath } from "@/lib/field-paths";

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
    ["yearsOfExperience", "2"],
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

  it("returns undefined when the profile lacks the data", () => {
    const sparse: Profile = { ...profile, phone: undefined, links: [], experience: [], education: [], workAuthorization: undefined };
    for (const path of ["phone", "linkedin", "portfolio", "currentCompany", "yearsOfExperience", "school", "authorizedToWork"]) {
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
