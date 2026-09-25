/**
 * Regression tests for the bugs found running the extension against live
 * Greenhouse, Lever, Ashby and Workable postings (2026-09-25). Each fixture
 * in tests/fixtures/portals is a trimmed DOM snapshot of a real, public
 * application form; see portal-helpers.ts for how its recorded layout is
 * replayed in jsdom.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DetectedField } from "@job-jet/shared";
import { collectFormFields, visibleText } from "../src/lib/fields";
import { NEVER_FILL, mapProfileToFields, runAutofillMapping, toLlmField, unresolvedFields } from "../src/lib/autofill-map";
import { parseLocation } from "../src/lib/location";
import { resumeInputsByFrame } from "../src/lib/resume-attach";
import { allByQuestion, byLabel, installLayoutMock, mountPortal } from "./portal-helpers";
import { profile } from "./helpers";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

const HOSTS = {
  greenhouse: "job-boards.greenhouse.io",
  lever: "jobs.eu.lever.co",
  ashby: "jobs.ashbyhq.com",
  workable: "apply.workable.com",
};

function fill(name: string, host: string) {
  mountPortal(name);
  const fields = collectFormFields();
  const mapped = runAutofillMapping(fields, profile, host);
  const value = (f: DetectedField) => mapped.find((m) => m.selector === f.selector)?.value;
  return { fields, mapped, value };
}

describe("bug 1: labels and group questions on real form layouts", () => {
  it("Ashby: question titles whose label[for] doesn't point at the input", () => {
    mountPortal("ashby-openai");
    const fields = collectFormFields();
    const location = fields.find((f) => f.placeholder === "Start typing...")!;
    expect(location.label).toBe("Where are you currently located?");
    expect(fields.find((f) => f.placeholder === "Pick date...")!.label).toBe("When can you start a new role?");
  });

  it("Lever: custom-card radios carry their question; labels skip helper text", () => {
    mountPortal("lever-eu-xtb");
    const fields = collectFormFields();
    const auth = allByQuestion(fields, /legally authorized to work in Poland/);
    expect(auth.map((f) => [f.type, f.label])).toEqual([
      ["radio", "Yes"],
      ["radio", "No"],
    ]);
    expect(byLabel(fields, /^Current location/).label).toBe("Current location");
    expect(fields.find((f) => f.type === "select")!.label).toBe("Have you previously been employed by XTB?");
  });

  it("Lever: a Yes/No checkbox question is one group", () => {
    mountPortal("lever-eu-lever");
    const fields = collectFormFields();
    expect(allByQuestion(fields, /unrestricted right to work in Canada/).map((f) => f.label)).toEqual(["Yes", "No"]);
  });

  it("Workable: aria-labelledby labels and fieldset[aria-labelledby] radio questions", () => {
    mountPortal("workable-huggingface");
    const fields = collectFormFields();
    expect(fields.find((f) => f.id === "firstname")!.label).toBe("First name");
    expect(allByQuestion(fields, /eligible to work in the country/).map((f) => f.label)).toEqual(["YES", "NO"]);
    expect(fields.some((f) => /SVGs not supported/.test(f.label ?? ""))).toBe(false);
  });

  it("Greenhouse: checkbox groups get the fieldset legend as their question", () => {
    mountPortal("greenhouse-bamboohr");
    const fields = collectFormFields();
    const boxes = fields.filter((f) => f.type === "checkbox");
    expect(boxes.length).toBe(5);
    expect(boxes.every((f) => /Do any of the following apply to you/.test(f.question ?? ""))).toBe(true);
  });

  it("never uses an inline SVG's fallback text as a label", () => {
    document.body.innerHTML = `<label>Notice period <svg><title>SVGs not supported by this browser.</title></svg><input name="n"></label>`;
    installLayoutMock();
    expect(collectFormFields()[0].label).toBe("Notice period");
    expect(visibleText(document.querySelector("label"))).toBe("Notice period");
  });
});

describe("bug 2: honeypot filter vs. custom-styled controls", () => {
  it("keeps Ashby's hidden Yes/No checkboxes (as yesno) and opacity-0 acknowledgement boxes", () => {
    mountPortal("ashby-openai");
    const fields = collectFormFields();
    const yesno = fields.filter((f) => f.type === "yesno");
    expect(yesno.map((f) => f.question)).toEqual([
      "Are you authorized to work in the country where the job is located?",
      "Will you now or in the future require sponsorship for employment visa status in this country?",
      "Are you able to work from our US office three days per week?",
    ]);
    expect(fields.filter((f) => f.type === "checkbox")).toHaveLength(2);
  });

  it("keeps Workable's opacity-0 radios that sit inside a visible label", () => {
    mountPortal("workable-huggingface");
    expect(collectFormFields().filter((f) => f.type === "radio")).toHaveLength(8);
  });

  it("still drops real honeypots: tiny text inputs and label-less hidden checkboxes", () => {
    document.body.innerHTML = `
      <label for="n">Name</label><input id="n" name="name">
      <input name="website" data-test-size="tiny">
      <input type="checkbox" name="trap" style="opacity:0" data-test-size="tiny">
      <input type="password" name="pw">`;
    installLayoutMock();
    expect(collectFormFields().map((f) => f.name)).toEqual(["name"]);
  });
});

describe("bug 4: the name rule never fills someone else's name", () => {
  it("Ashby Linear: 'referred you … include their name' stays empty", () => {
    const { fields, value } = fill("ashby-linear", HOSTS.ashby);
    expect(value(byLabel(fields, /referred you/))).toBeUndefined();
    expect(value(byLabel(fields, /^Name$/))).toBe("Priya Sharma");
  });

  it("Greenhouse BambooHR: 'legal name while working at BambooHR previously' stays empty", () => {
    const { fields, value } = fill("greenhouse-bamboohr", HOSTS.greenhouse);
    expect(value(byLabel(fields, /legal name while working/))).toBeUndefined();
  });

  it.each(["Referrer's name", "Emergency contact name", "Name of your manager", "Reference name", "Recruiter name"])(
    "%s",
    (label) => {
      expect(mapProfileToFields([{ selector: "s", type: "text", label }], profile)).toEqual([]);
    }
  );
});

describe("bug 5: address, city, state, zip, country", () => {
  it("Greenhouse BambooHR: no street/zip, city only, state and country derived", () => {
    const { fields, value } = fill("greenhouse-bamboohr", HOSTS.greenhouse);
    expect(value(byLabel(fields, /^Street Address/))).toBeUndefined();
    expect(value(byLabel(fields, /^Zip Code/))).toBeUndefined();
    expect(value(byLabel(fields, /^City$/))).toBe("San Francisco");
    expect(value(byLabel(fields, /^State/))).toBe("California");
    expect(value(byLabel(fields, /^Country$/))).toBe("United States");
    expect(value(byLabel(fields, /^Location \(City\)/))).toBe("San Francisco, CA");
  });

  it("parseLocation only returns parts it can derive", () => {
    expect(parseLocation("San Francisco, CA")).toEqual({ city: "San Francisco", state: "California", country: "United States" });
    expect(parseLocation("Berlin, Germany")).toEqual({ city: "Berlin", country: "Germany" });
    expect(parseLocation("Springfield")).toEqual({ city: "Springfield" });
    expect(parseLocation("Somewhere, Atlantis")).toEqual({ city: "Somewhere" });
    expect(parseLocation(undefined)).toEqual({});
  });

  it("country is left empty when it can't be derived", () => {
    const sparse = { ...profile, location: "Springfield" };
    expect(mapProfileToFields([{ selector: "c", type: "text", label: "Country" }], sparse)).toEqual([]);
  });
});

describe("bug 6: GitHub only goes into GitHub profile fields", () => {
  it("Workable: essay mentioning GitHub PRs stays empty, 'Github profile' textarea is filled", () => {
    const { fields, value } = fill("workable-huggingface", HOSTS.workable);
    expect(value(byLabel(fields, /open-source contributions with links/))).toBeUndefined();
    expect(value(byLabel(fields, /^Github profile$/))).toBe("https://github.com/priyasharma");
  });

  it("long / essay GitHub questions are skipped", () => {
    const fields: DetectedField[] = [
      { selector: "a", type: "textarea", label: "Tell us about a GitHub project you are proud of" },
      { selector: "b", type: "text", label: "GitHub username" },
      { selector: "c", type: "url", label: "GitHub" },
    ];
    expect(mapProfileToFields(fields, profile).map((m) => m.selector)).toEqual(["b", "c"]);
  });
});

describe("bug 7: the company rule only fills current-employer fields", () => {
  it.each([
    "Company size preference",
    "Preferred company stage",
    "Company industry",
    "Why this company?",
    "Have you worked for this company before?",
    "How did you hear about our company?",
  ])("skips %s", (label) => {
    expect(mapProfileToFields([{ selector: "s", type: "select", label, options: ["1-10", "11-50"] }], profile)).toEqual(
      []
    );
  });

  it.each(["Current company", "Company name", "Current employer", "Most recent employer"])("fills %s", (label) => {
    expect(mapProfileToFields([{ selector: "s", type: "text", label }], profile)).toEqual([
      { selector: "s", value: "Nimbus Analytics" },
    ]);
  });
});

describe("work authorization / sponsorship reach every Yes/No widget", () => {
  it("Greenhouse react-select dropdowns (incl. the 'file a petition' wording)", () => {
    const { fields, value } = fill("greenhouse-bamboohr", HOSTS.greenhouse);
    expect(value(byLabel(fields, /legally authorized to work in the United States/))).toBe("Yes");
    expect(value(byLabel(fields, /file a petition/))).toBe("No");
  });

  it("Lever radios: only the matching option is emitted", () => {
    const { fields, value } = fill("lever-eu-xtb", HOSTS.lever);
    const [yes, no] = allByQuestion(fields, /legally authorized to work in Poland/);
    expect(value(yes)).toBe("Yes");
    expect(value(no)).toBeUndefined();
  });

  it("Lever select whose question lives in the placeholder option ('Do you need a visa or work permit')", () => {
    const { fields, value } = fill("lever-eu-xtb", HOSTS.lever);
    expect(value(byLabel(fields, /^Visa permission$/))).toBe("No");
  });

  it("Lever Yes/No checkboxes", () => {
    const { fields, value } = fill("lever-eu-lever", HOSTS.lever);
    const [yes, no] = allByQuestion(fields, /unrestricted right to work in Canada/);
    expect([value(yes), value(no)]).toEqual(["Yes", undefined]);
  });

  it("Lever: 'Other website' isn't a copy of the portfolio URL the adapter already filled", () => {
    const { fields, value } = fill("lever-eu-lever", HOSTS.lever);
    expect(value(byLabel(fields, /^Portfolio URL/))).toBe("https://priyasharma.dev");
    expect(value(byLabel(fields, /^Other website/))).toBeUndefined();
  });

  it("Ashby Yes/No buttons", () => {
    const { fields, value } = fill("ashby-openai", HOSTS.ashby);
    expect(value(byLabel(fields, /authorized to work in the country/))).toBe("Yes");
    expect(value(byLabel(fields, /require sponsorship/))).toBe("No");
    expect(value(byLabel(fields, /US office three days/))).toBeUndefined();
  });

  it("Workable YES/NO radios", () => {
    const { fields, value } = fill("workable-huggingface", HOSTS.workable);
    const [yes, no] = allByQuestion(fields, /eligible to work in the country/);
    expect([value(yes), value(no)]).toEqual(["Yes", undefined]);
  });

  it("a group that got its answer isn't also sent to the LLM tier", () => {
    const { fields, mapped } = fill("lever-eu-xtb", HOSTS.lever);
    const left = unresolvedFields(fields, mapped);
    expect(left.some((f) => /legally authorized to work in Poland/.test(f.question ?? ""))).toBe(false);
    expect(left.some((f) => /UoP/.test(f.question ?? ""))).toBe(true);
    expect(toLlmField(left.find((f) => /UoP/.test(f.question ?? ""))!).label).toMatch(/UoP.*— Yes$/);
  });
});

describe("bug 9: demographic questions are never filled nor sent to the LLM", () => {
  it.each([
    "I consider myself a member of the LGBTQ+ community. (optional)",
    "Sexual orientation",
    "Are you Hispanic/Latino?",
    "Do you identify as transgender?",
    "Disability Status",
    "Protected veteran status",
    "Race or Ethnicity (optional)",
    "Gender Identity (optional)",
    "Date of birth",
  ])("%s", (label) => {
    expect(NEVER_FILL.test(label)).toBe(true);
  });

  it("still fills unrelated questions containing similar letters", () => {
    for (const label of ["Engender trust", "Stage of company", "Language skills", "Grace period"]) {
      expect(NEVER_FILL.test(label)).toBe(false);
    }
  });

  it("Greenhouse Discord: the LGBTQ+ and Hispanic/Latino questions stay out of every tier", () => {
    const { fields, mapped } = fill("greenhouse-discord", HOSTS.greenhouse);
    const left = unresolvedFields(fields, mapped).map((f) => f.label ?? "");
    expect(left.some((l) => /LGBTQ|Hispanic|Gender|Veteran|Disability|Race/i.test(l))).toBe(false);
  });
});

describe("bug 12: resume attach target", () => {
  it("picks the form's own resume input, never Ashby's 'autofill from resume' importer", () => {
    const fields: DetectedField[] = [
      { selector: "a", type: "file", label: "Autofill from resume Upload your resume here to autofill key application fields" },
      { selector: "b", type: "file", id: "_systemfield_resume", label: "Resume" },
      { selector: "c", type: "file", label: "Cover letter" },
      { selector: "d", type: "file", id: "resume", label: "Attach", frameId: 3 },
      { selector: "e", type: "text", label: "First Name" },
      { selector: "f", type: "text", label: "First Name", frameId: 3 },
    ];
    expect(resumeInputsByFrame(fields).map((f) => f.selector)).toEqual(["b", "d"]);
  });

  it("skips a frame whose form is collapsed (only file inputs survived the visibility filter)", () => {
    const fields: DetectedField[] = [
      { selector: "a", type: "file", id: "resume", label: "Attach", frameId: 7 },
      { selector: "b", type: "file", id: "cover_letter", label: "Attach", frameId: 7 },
    ];
    expect(resumeInputsByFrame(fields)).toEqual([]);
  });

  it("finds the resume input on each real form", () => {
    for (const [name, host] of [
      ["greenhouse-bamboohr", HOSTS.greenhouse],
      ["lever-eu-xtb", HOSTS.lever],
      ["ashby-openai", HOSTS.ashby],
      ["workable-huggingface", HOSTS.workable],
    ] as const) {
      const { fields } = fill(name, host);
      expect(resumeInputsByFrame(fields)).toHaveLength(1);
      vi.restoreAllMocks();
    }
  });
});
