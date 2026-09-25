import { describe, expect, it } from "vitest";
import type { DetectedField } from "@job-jet/shared";
import { fieldText, mapProfileToFields, matches, NEVER_FILL, runAutofillMapping } from "../src/lib/autofill-map";
import { ashbyFields, greenhouseFields, leverFields } from "./captured-fields";
import { profile } from "./helpers";

const field = (f: Partial<DetectedField> & { selector: string }): DetectedField => ({ type: "text", ...f });
const asMap = (results: { selector: string; value: string }[]) =>
  Object.fromEntries(results.map((r) => [r.selector, r.value]));

describe("fieldText / matches", () => {
  it("joins label, name, id and placeholder, lowercased", () => {
    expect(fieldText(field({ selector: "s", label: "First Name", name: "fname", id: "FN", placeholder: "Jane" }))).toBe(
      "first name fname fn jane"
    );
  });

  it("tests any of the patterns", () => {
    expect(matches(field({ selector: "s", label: "E-mail" }), /phone/, /e-?mail/)).toBe(true);
    expect(matches(field({ selector: "s", label: "Address" }), /phone/)).toBe(false);
  });

  it("NEVER_FILL covers voluntary EEO questions", () => {
    for (const label of ["Pronouns", "Veteran Status", "Disability", "Race / Ethnicity", "Gender"]) {
      expect(NEVER_FILL.test(label)).toBe(true);
    }
    expect(NEVER_FILL.test("Engender trust")).toBe(false);
  });
});

describe("mapProfileToFields (heuristic tier)", () => {
  it("fills core contact fields from the profile", () => {
    const result = asMap(
      mapProfileToFields(
        [
          field({ selector: "a", label: "First Name" }),
          field({ selector: "b", label: "Last Name" }),
          field({ selector: "c", type: "email", label: "Your contact" }),
          field({ selector: "d", type: "tel", label: "Mobile" }),
          field({ selector: "e", label: "Full name" }),
          field({ selector: "f", label: "City" }),
        ],
        profile
      )
    );
    expect(result).toEqual({
      a: "Priya",
      b: "Sharma",
      c: "priya.sharma@example.com",
      d: "+1 415 555 0192",
      e: "Priya Sharma",
      f: "San Francisco, CA",
    });
  });

  it("recognizes Ashby's 'Legal Name' label as full name", () => {
    expect(mapProfileToFields([field({ selector: "n", label: "Legal Name" })], profile)).toEqual([
      { selector: "n", value: "Priya Sharma" },
    ]);
  });

  it("maps links, work authorization and education", () => {
    const result = asMap(
      mapProfileToFields(
        [
          field({ selector: "li", label: "LinkedIn Profile" }),
          field({ selector: "web", label: "Other Website" }),
          field({
            selector: "auth",
            type: "select",
            name: "workAuthorization",
            label: "Are you legally authorized to work in the US?",
          }),
          field({ selector: "spon", type: "select", label: "Will you require visa sponsorship?" }),
          field({ selector: "school", label: "University" }),
          field({ selector: "deg", label: "Degree" }),
          field({ selector: "major", label: "Field of study" }),
        ],
        profile
      )
    );
    expect(result).toEqual({
      li: "https://linkedin.com/in/priyasharma",
      web: "https://priyasharma.dev",
      auth: "Yes",
      spon: "No",
      school: "University of Washington",
      deg: "B.S.",
      major: "Computer Science",
    });
  });

  it("only uses the summary for cover-letter textareas", () => {
    expect(mapProfileToFields([field({ selector: "cl", type: "textarea", label: "Cover letter" })], profile)).toEqual([
      { selector: "cl", value: profile.summary },
    ]);
    expect(mapProfileToFields([field({ selector: "cl", type: "file", label: "Cover letter" })], profile)).toEqual([]);
  });

  it("fills employer/company fields (not company URL fields) with the most recent company", () => {
    const result = asMap(
      mapProfileToFields(
        [
          field({ selector: "cur", label: "Current employer" }),
          field({ selector: "name", label: "Company Name" }),
          field({ selector: "url", label: "Company URL" }),
        ],
        profile
      )
    );
    expect(result.cur).toBe("Nimbus Analytics");
    expect(result.name).toBe("Nimbus Analytics");
    expect(result.url).toBeUndefined();
  });

  it("never fills EEO questions, file inputs, or unknown free-text questions", () => {
    expect(
      mapProfileToFields(
        [
          field({ selector: "g", label: "Gender" }),
          field({ selector: "r", type: "file", label: "Resume" }),
          field({ selector: "s", label: "Desired salary" }),
          field({ selector: "h", label: "How did you hear about us?" }),
        ],
        profile
      )
    ).toEqual([]);
  });

  it("skips fields when the profile has no value", () => {
    const sparse = { ...profile, phone: undefined, links: [], experience: [], education: [] };
    expect(
      mapProfileToFields(
        [field({ selector: "p", type: "tel", label: "Phone" }), field({ selector: "l", label: "LinkedIn" })],
        sparse
      )
    ).toEqual([]);
  });
});

describe("runAutofillMapping on real captured forms", () => {
  it("Greenhouse: adapter fills core fields, heuristic fills custom questions, EEO skipped", () => {
    const result = asMap(runAutofillMapping(greenhouseFields, profile, "job-boards.greenhouse.io"));
    expect(result).toEqual({
      "sel-0": "Priya",
      "sel-1": "Sharma",
      "sel-2": "priya.sharma@example.com",
      "sel-3": "+1 415 555 0192",
      "sel-4": "San Francisco, CA",
      "sel-6": "https://linkedin.com/in/priyasharma",
      "sel-7": "https://priyasharma.dev",
    });
  });

  it("Lever: fills every standard field, leaves the custom start-date question", () => {
    const result = asMap(runAutofillMapping(leverFields, profile, "jobs.lever.co"));
    expect(result).toEqual({
      "sel-1": "Priya Sharma",
      "sel-2": "priya.sharma@example.com",
      "sel-3": "+1 415 555 0192",
      "sel-4": "San Francisco, CA",
      "sel-5": "Nimbus Analytics",
      "sel-6": "https://linkedin.com/in/priyasharma",
      "sel-7": "https://github.com/priyasharma",
      "sel-8": "https://priyasharma.dev",
    });
  });

  it("Ashby: system fields via adapter, labelled custom questions via heuristic", () => {
    const result = asMap(runAutofillMapping(ashbyFields, profile, "jobs.ashbyhq.com"));
    expect(result).toMatchObject({
      "sel-1": "Priya Sharma",
      "sel-4": "priya.sharma@example.com",
      "sel-5": "+1 415 555 0192",
      "sel-7": "https://linkedin.com/in/priyasharma",
      "sel-8": "https://priyasharma.dev",
    });
    expect(result["sel-3"]).toBeUndefined(); // pronouns
    expect(result["sel-0"]).toBeUndefined(); // file
    expect(result["sel-6"]).toBeUndefined(); // resume file
  });

  it("never fills the same selector twice", () => {
    for (const [fields, host] of [
      [greenhouseFields, "job-boards.greenhouse.io"],
      [leverFields, "jobs.lever.co"],
      [ashbyFields, "jobs.ashbyhq.com"],
    ] as const) {
      const selectors = runAutofillMapping(fields, profile, host).map((r) => r.selector);
      expect(new Set(selectors).size).toBe(selectors.length);
    }
  });

  it("falls back to the heuristic alone on unknown hosts", () => {
    expect(runAutofillMapping(greenhouseFields, profile, "careers.example.com")).toEqual(
      mapProfileToFields(greenhouseFields, profile)
    );
  });
});
