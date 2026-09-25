/**
 * Vitest port of scripts/test-engine.ts (the standalone engine check added
 * in "fix: detecting"), so the same assertions run in CI. The script is kept
 * and still runs on its own: `npm run test:engine --workspace=apps/extension`.
 */
import { describe, expect, it } from "vitest";
import type { DetectedField, Profile } from "@job-jet/shared";
import { findLink, firstAndLastName, yesNo } from "../src/lib/profile-utils";
import { getAdapter } from "../src/lib/adapters";
import { mapProfileToFields, runAutofillMapping } from "../src/lib/autofill-map";

const sampleProfile: Profile = {
  id: "p1",
  userId: "u1",
  fullName: "Alice Smith",
  email: "alice@example.com",
  phone: "+1 555 987 6543",
  location: "New York, NY",
  links: [
    { label: "LinkedIn", url: "https://linkedin.com/in/alicesmith" },
    { label: "GitHub", url: "https://github.com/alicesmith" },
    { label: "Portfolio", url: "https://alicesmith.dev" },
  ],
  summary: "Staff Engineer with 10 years of experience.",
  education: [{ id: "e1", school: "MIT", degree: "B.S.", fieldOfStudy: "Computer Science" }],
  experience: [{ id: "x1", company: "Acme Corp", title: "Staff Engineer", current: true, bullets: ["Bullet 1", "Bullet 2"] }],
  skills: [{ name: "TypeScript" }, { name: "React" }],
  workAuthorization: { authorizedToWork: true, requiresSponsorship: false },
};

const toMap = (r: { selector: string; value: string }[]) => new Map(r.map((m) => [m.selector, m.value]));

describe("profile utils", () => {
  it("splits names and formats yes/no", () => {
    expect(firstAndLastName("Jane Doe")).toMatchObject({ first: "Jane", last: "Doe" });
    expect(firstAndLastName("Dr. Jane Mary Doe")).toMatchObject({ first: "Dr.", last: "Jane Mary Doe" });
    expect(firstAndLastName("SingleName").last).toBe("");
    expect(yesNo(true)).toBe("Yes");
    expect(yesNo(false)).toBe("No");
    expect(yesNo(undefined)).toBeUndefined();
  });

  it("finds links by label", () => {
    expect(findLink(sampleProfile, "linkedin")).toBe("https://linkedin.com/in/alicesmith");
    expect(findLink(sampleProfile, "github")).toBe("https://github.com/alicesmith");
    expect(findLink(sampleProfile, "portfolio")).toBe("https://alicesmith.dev");
  });
});

describe("adapter hostname matching", () => {
  it.each([
    ["job-boards.greenhouse.io", "Greenhouse"],
    ["boards.greenhouse.io", "Greenhouse"],
    ["jobs.ashbyhq.com", "Ashby"],
    ["jobs.lever.co", "Lever"],
    ["jobs.eu.lever.co", "Lever"],
  ])("%s -> %s", (host, name) => {
    expect(getAdapter(host)?.name).toBe(name);
  });
});

describe("autofill heuristics and exclusions", () => {
  const fields: DetectedField[] = [
    { selector: "s-first", type: "text", label: "First Name" },
    { selector: "s-last", type: "text", label: "Last Name" },
    { selector: "s-full", type: "text", label: "Full Name" },
    { selector: "s-legal", type: "text", label: "Legal Name" },
    { selector: "s-name", type: "text", label: "Name", name: "name" },
    { selector: "s-email", type: "email", label: "Email Address" },
    { selector: "s-phone", type: "tel", label: "Phone Number" },
    { selector: "s-loc", type: "text", label: "Location" },
    { selector: "s-linkedin", type: "url", label: "LinkedIn URL" },
    { selector: "s-github", type: "url", label: "GitHub Profile" },
    { selector: "s-portfolio", type: "url", label: "Personal Website" },
    { selector: "s-auth", type: "select", label: "Are you authorized to work in the US?" },
    { selector: "s-sponsor", type: "select", label: "Will you require visa sponsorship?" },
    { selector: "s-company", type: "text", label: "Current Company" },
    { selector: "s-title", type: "text", label: "Current Title" },
    { selector: "s-school", type: "text", label: "School / University" },
    { selector: "s-degree", type: "text", label: "Degree" },
    { selector: "s-major", type: "text", label: "Major / Field of Study" },
    { selector: "s-file", type: "file", label: "Upload Resume" },
    { selector: "s-gender", type: "select", label: "Gender" },
    { selector: "s-race", type: "select", label: "Race / Ethnicity" },
    { selector: "s-veteran", type: "select", label: "Veteran Status" },
    { selector: "s-disability", type: "select", label: "Disability Status" },
    { selector: "s-pronouns", type: "select", label: "Pronouns" },
  ];
  const map = toMap(mapProfileToFields(fields, sampleProfile));

  it("maps profile values", () => {
    expect(Object.fromEntries(map)).toMatchObject({
      "s-first": "Alice",
      "s-last": "Smith",
      "s-full": "Alice Smith",
      "s-legal": "Alice Smith",
      "s-name": "Alice Smith",
      "s-email": "alice@example.com",
      "s-phone": "+1 555 987 6543",
      "s-loc": "New York, NY",
      "s-linkedin": "https://linkedin.com/in/alicesmith",
      "s-github": "https://github.com/alicesmith",
      "s-portfolio": "https://alicesmith.dev",
      "s-auth": "Yes",
      "s-sponsor": "No",
      "s-company": "Acme Corp",
      "s-title": "Staff Engineer",
      "s-school": "MIT",
      "s-degree": "B.S.",
      "s-major": "Computer Science",
    });
  });

  it("never maps file inputs or EEO questions", () => {
    for (const s of ["s-file", "s-gender", "s-race", "s-veteran", "s-disability", "s-pronouns"]) {
      expect(map.has(s)).toBe(false);
    }
  });
});

describe("negative name matching", () => {
  it("doesn't put the person's name into company/school/username/preferred-name fields", () => {
    const m = toMap(
      mapProfileToFields(
        [
          { selector: "neg-company", type: "text", label: "Company Name" },
          { selector: "neg-school", type: "text", label: "School Name" },
          { selector: "neg-user", type: "text", label: "Username" },
          { selector: "neg-preferred", type: "text", label: "Preferred Name" },
        ],
        sampleProfile
      )
    );
    expect(m.get("neg-company")).toBe("Acme Corp");
    expect(m.get("neg-school")).toBe("MIT");
    expect(m.has("neg-user")).toBe(false);
    expect(m.has("neg-preferred")).toBe(false);
  });
});

describe("link fallbacks", () => {
  it("fills GitHub specifically and falls back to GitHub for a website without a portfolio", () => {
    const noPortfolio: Profile = { ...sampleProfile, links: sampleProfile.links.slice(0, 2) };
    const m = toMap(
      mapProfileToFields(
        [
          { selector: "w-site", type: "text", label: "Personal Website" },
          { selector: "w-gh", type: "text", label: "GitHub Profile" },
        ],
        noPortfolio
      )
    );
    expect(m.get("w-gh")).toBe("https://github.com/alicesmith");
    expect(m.get("w-site")).toBe("https://github.com/alicesmith");
  });
});

describe("adapter precedence and composition", () => {
  it("lets the Lever adapter claim core fields and the heuristic fill the rest", () => {
    const m = toMap(
      runAutofillMapping(
        [
          { selector: "lev-1", type: "text", name: "name", label: "Full Name" },
          { selector: "lev-2", type: "text", name: "email", label: "Email" },
          { selector: "lev-3", type: "text", id: "custom_q1", label: "Current Title" },
        ],
        sampleProfile,
        "jobs.lever.co"
      )
    );
    expect(m.get("lev-1")).toBe("Alice Smith");
    expect(m.get("lev-2")).toBe("alice@example.com");
    expect(m.get("lev-3")).toBe("Staff Engineer");
  });
});
