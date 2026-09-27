/**
 * Saved answers (Profile -> Saved answers) against the live-portal
 * fixtures: notice period, visa, salary and custom answers (Lever XTB),
 * country-specific right to work (Lever Canada, Lever XTB Poland,
 * Greenhouse US), how did you hear (Greenhouse, Workable), start date and
 * office days (Ashby), and opt-in voluntary demographics.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { DECLINE_ANSWER, type DetectedField, type Profile } from "@job-jet/shared";
import { collectFormFields } from "../src/lib/fields";
import { mapProfileToFields, runAutofillMapping, unresolvedFields } from "../src/lib/autofill-map";
import { mainWorldFill } from "../src/lib/main-world-fill";
import {
  DECLINE_SENTINEL,
  demographicCategory,
  optionCoversNumber,
  optionMatchesText,
  pickOption,
  recurringAnswer,
} from "../src/lib/saved-answers";
import { allByQuestion, byLabel, mountPortal } from "./portal-helpers";
import { profile as baseProfile } from "./helpers";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.innerHTML = "";
});

const HOSTS = {
  greenhouse: "job-boards.greenhouse.io",
  lever: "jobs.eu.lever.co",
  ashby: "jobs.ashbyhq.com",
  workable: "apply.workable.com",
};

const withAnswers: Profile = {
  ...baseProfile,
  applicationAnswers: {
    referralSource: "LinkedIn",
    noticePeriod: "1 month",
    salary: { amount: 180000, currency: "USD", period: "year" },
    willingToRelocate: true,
    workModes: ["remote", "hybrid"],
    yearsOfExperience: 7,
    workAuthorizationByCountry: [
      { country: "US", authorizedToWork: true, requiresSponsorship: false },
      { country: "Poland", authorizedToWork: false, requiresSponsorship: true },
      { country: "Canada", authorizedToWork: false, requiresSponsorship: true },
    ],
    customAnswers: [{ id: "c1", question: "previously been employed by", answer: "No" }],
  },
};

function fill(name: string, host: string, profile: Profile = withAnswers) {
  mountPortal(name);
  const fields = collectFormFields();
  const mapped = runAutofillMapping(fields, profile, host);
  const value = (f: DetectedField) => mapped.find((m) => m.selector === f.selector)?.value;
  return { fields, mapped, value };
}

describe("Lever XTB: notice period, visa, salary, Poland, custom answer", () => {
  it("picks the notice-period option matching the saved '1 month'", () => {
    const { fields, value } = fill("lever-eu-xtb", HOSTS.lever);
    expect(value(byLabel(fields, /notice period/))).toBe("1 month");
  });

  it("answers 'Visa permission' from the default sponsorship answer (no country named)", () => {
    const { fields, value } = fill("lever-eu-xtb", HOSTS.lever);
    // Default profile: no sponsorship needed -> the single "No, ..." option.
    expect(value(byLabel(fields, /^Visa permission/))).toBe("No");
  });

  it("types the monthly salary (converted from yearly) with the currency the question asks for", () => {
    const { fields, value } = fill("lever-eu-xtb", HOSTS.lever);
    expect(value(byLabel(fields, /expected monthly base salary/))).toBe("15000 USD");
  });

  it("uses the Poland entry for 'legally authorized to work in Poland'", () => {
    const { fields, value } = fill("lever-eu-xtb", HOSTS.lever);
    const [yes, no] = allByQuestion(fields, /legally authorized to work in Poland/);
    expect(value(yes)).toBeUndefined();
    expect(value(no)).toBe("No");
  });

  it("fills a <select> from a custom answer ('Have you previously been employed by XTB?')", () => {
    const { fields, value } = fill("lever-eu-xtb", HOSTS.lever);
    expect(value(byLabel(fields, /previously been employed by XTB/))).toBe("No");
  });

  it("leaves the non-Yes/No language radios and the UoP question alone", () => {
    const { fields, value } = fill("lever-eu-xtb", HOSTS.lever);
    for (const f of allByQuestion(fields, /Polish language|employment contract/)) expect(value(f)).toBeUndefined();
  });

  it("without saved answers, notice period and salary stay empty", () => {
    const { fields, value } = fill("lever-eu-xtb", HOSTS.lever, baseProfile);
    expect(value(byLabel(fields, /notice period/))).toBeUndefined();
    expect(value(byLabel(fields, /expected monthly base salary/))).toBeUndefined();
  });
});

describe("Lever: country-specific right to work (Canada)", () => {
  it("uses the Canada entry, not the default", () => {
    const { fields, value } = fill("lever-eu-lever", HOSTS.lever);
    const [yes, no] = allByQuestion(fields, /unrestricted right to work in Canada/);
    expect(value(yes)).toBeUndefined();
    expect(value(no)).toBe("No");
  });

  it("falls back to the default when the user has no per-country answers", () => {
    const { fields, value } = fill("lever-eu-lever", HOSTS.lever, baseProfile);
    const [yes, no] = allByQuestion(fields, /unrestricted right to work in Canada/);
    expect(value(yes)).toBe("Yes");
    expect(value(no)).toBeUndefined();
  });

  it("leaves it unanswered when the user keeps a list without Canada", () => {
    const p: Profile = {
      ...withAnswers,
      applicationAnswers: { workAuthorizationByCountry: [{ country: "India", authorizedToWork: true }] },
    };
    const { fields, value } = fill("lever-eu-lever", HOSTS.lever, p);
    for (const f of allByQuestion(fields, /unrestricted right to work in Canada/)) expect(value(f)).toBeUndefined();
  });
});

describe("Greenhouse: how did you hear, relocation, US authorization, salary", () => {
  it("answers 'How did you hear about this job?' with the saved source", () => {
    const { fields, value } = fill("greenhouse-discord", HOSTS.greenhouse);
    expect(value(byLabel(fields, /How did you hear about this job/))).toBe("LinkedIn");
  });

  it("never puts the LinkedIn URL or company into a how-did-you-hear question", () => {
    const { fields, value } = fill("greenhouse-bamboohr", HOSTS.greenhouse, baseProfile);
    expect(value(byLabel(fields, /How did you hear about BambooHR/))).toBeUndefined();
  });

  it("'based in or willing to relocate to the Bay Area' -> Yes when willing to relocate", () => {
    const { fields, value } = fill("greenhouse-discord", HOSTS.greenhouse);
    expect(value(byLabel(fields, /willing to relocate/))).toBe("Yes");
  });

  it("uses the US entry for 'legally authorized to work in the United States'", () => {
    const p: Profile = {
      ...withAnswers,
      workAuthorization: { authorizedToWork: false, requiresSponsorship: true },
    };
    const { fields, value } = fill("greenhouse-bamboohr", HOSTS.greenhouse, p);
    expect(value(byLabel(fields, /legally authorized to work in the United States/))).toBe("Yes");
  });

  it("types the desired salary with currency and period", () => {
    const { fields, value } = fill("greenhouse-bamboohr", HOSTS.greenhouse);
    expect(value(byLabel(fields, /^Desired Salary/))).toBe("180000 USD per year");
  });
});

describe("Ashby: start date, notice period, office days", () => {
  it("fills the date picker with the saved start date (MM/DD/YYYY)", () => {
    const p: Profile = {
      ...withAnswers,
      applicationAnswers: { ...withAnswers.applicationAnswers, earliestStartDate: "2030-01-15" },
    };
    const { fields, value } = fill("ashby-openai", HOSTS.ashby, p);
    expect(value(byLabel(fields, /When can you start a new role/))).toBe("01/15/2030");
  });

  it("derives the start date from the notice period when no date is saved", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T09:00:00Z"));
    const { fields, value } = fill("ashby-openai", HOSTS.ashby);
    expect(value(byLabel(fields, /When can you start a new role/))).toBe("10/31/2026");
  });

  it("'able to work from our US office three days per week?' -> Yes for hybrid", () => {
    const { fields, value } = fill("ashby-openai", HOSTS.ashby);
    expect(value(byLabel(fields, /US office three days/))).toBe("Yes");
  });

  it("... and No when the user only wants remote", () => {
    const p: Profile = {
      ...withAnswers,
      applicationAnswers: { ...withAnswers.applicationAnswers, workModes: ["remote"] },
    };
    const { fields, value } = fill("ashby-openai", HOSTS.ashby, p);
    expect(value(byLabel(fields, /US office three days/))).toBe("No");
  });

  it("types the notice period into Linear's 'Notice Period' text field", () => {
    const { fields, value } = fill("ashby-linear", HOSTS.ashby);
    expect(value(byLabel(fields, /^Notice Period/))).toBe("1 month");
  });

  it("authorization/sponsorship questions without a country use the default", () => {
    const { fields, value } = fill("ashby-openai", HOSTS.ashby);
    expect(value(byLabel(fields, /authorized to work in the country/))).toBe("Yes");
    expect(value(byLabel(fields, /require sponsorship/))).toBe("No");
  });
});

describe("Workable: notice, salary, how did you hear", () => {
  it("fills all three from saved answers", () => {
    const { fields, value } = fill("workable-huggingface", HOSTS.workable);
    expect(value(byLabel(fields, /Notice period \/ availability/))).toBe("1 month");
    expect(value(byLabel(fields, /^Expected salary/))).toBe("180000 USD per year");
    expect(value(byLabel(fields, /How did you hear about us/))).toBe("LinkedIn");
  });
});

describe("voluntary demographics: only explicit answers", () => {
  it("default: none of the EEO questions are filled or sent to the AI tier", () => {
    const { fields, mapped } = fill("greenhouse-discord", HOSTS.greenhouse);
    const eeo = fields.filter((f) => /gender|race|ethnicity|veteran|disability|lgbtq|hispanic/i.test(f.label ?? ""));
    expect(eeo.length).toBeGreaterThan(5);
    for (const f of eeo) expect(mapped.find((m) => m.selector === f.selector)).toBeUndefined();
    const leftover = unresolvedFields(fields, mapped);
    for (const f of eeo) expect(leftover.includes(f)).toBe(false);
  });

  it("fills only the categories the user answered; 'decline' picks the decline option", () => {
    const p: Profile = {
      ...withAnswers,
      applicationAnswers: {
        ...withAnswers.applicationAnswers,
        demographics: { gender: DECLINE_ANSWER, veteranStatus: "I am not a protected veteran" },
      },
    };
    const { fields, value } = fill("greenhouse-discord", HOSTS.greenhouse, p);
    const genders = fields.filter((f) => /^Gender$/.test(f.label ?? ""));
    expect(genders.length).toBe(2);
    for (const g of genders) expect(value(g)).toBe(DECLINE_SENTINEL);
    for (const v of fields.filter((f) => /^Veteran Status/.test(f.label ?? "")))
      expect(value(v)).toBe("I am not a protected veteran");
    for (const f of fields.filter((x) => /race|ethnicity|disability|lgbtq|hispanic/i.test(x.label ?? ""))) {
      expect(value(f)).toBeUndefined();
    }
  });

  it("pronouns are filled only when set", () => {
    const field: DetectedField = { selector: "#p", type: "text", label: "Pronouns" };
    expect(mapProfileToFields([field], withAnswers)).toEqual([]);
    const p: Profile = { ...withAnswers, applicationAnswers: { pronouns: "she/her" } };
    expect(mapProfileToFields([field], p)).toEqual([{ selector: "#p", value: "she/her" }]);
  });

  it("classifies categories, most specific first", () => {
    const c = (label: string) => demographicCategory({ selector: "x", type: "text", label });
    expect(c("Gender Identity (optional)")).toBe("gender");
    expect(c("Are you Hispanic/Latino?")).toBe("hispanicLatino");
    expect(c("Race and Ethnicity")).toBe("raceEthnicity");
    expect(c("I consider myself a member of the LGBTQ+ community.")).toBe("lgbtq");
    expect(c("Do you identify as transgender?")).toBe("transgender");
    expect(c("Disability Status")).toBe("disabilityStatus");
    expect(c("Veteran Status")).toBe("veteranStatus");
    expect(c("Email")).toBeUndefined();
  });
});

describe("options and custom answers", () => {
  it("radio groups: only the option matching the saved answer", () => {
    const q = "What is your notice period?";
    const opts = ["Immediately", "2 weeks", "1 month", "3 months"].map((label, i) => ({
      selector: `#n${i}`,
      type: "radio",
      label,
      question: q,
    }));
    expect(mapProfileToFields(opts, withAnswers)).toEqual([{ selector: "#n2", value: "1 month" }]);
  });

  it("work-mode radios: the most preferred mode", () => {
    const q = "What is your preferred work arrangement?";
    const opts = ["On-site", "Hybrid", "Remote"].map((label, i) => ({
      selector: `#w${i}`,
      type: "radio",
      label,
      question: q,
    }));
    expect(mapProfileToFields(opts, withAnswers)).toEqual([{ selector: "#w2", value: "Remote" }]);
  });

  it("years-of-experience select ranges", () => {
    const field: DetectedField = {
      selector: "#y",
      type: "select",
      label: "Years of professional experience",
      options: ["Select...", "0-2 years", "3-5 years", "6-9 years", "10+ years"],
    };
    expect(mapProfileToFields([field], withAnswers)).toEqual([{ selector: "#y", value: "6-9 years" }]);
    expect(optionCoversNumber("Less than 2", 1)).toBe(true);
    expect(optionCoversNumber("10 or more", 12)).toBe(true);
    expect(optionCoversNumber("5+", 4)).toBe(false);
  });

  it("referral-source select picks the matching option or nothing", () => {
    const field: DetectedField = {
      selector: "#h",
      type: "select",
      label: "How did you hear about us?",
      options: ["Select...", "LinkedIn", "Indeed", "Company website", "Referral"],
    };
    expect(mapProfileToFields([field], withAnswers)).toEqual([{ selector: "#h", value: "LinkedIn" }]);
    const p: Profile = { ...withAnswers, applicationAnswers: { referralSource: "A friend at a meetup" } };
    expect(mapProfileToFields([field], p)).toEqual([]);
  });

  it("custom answers match by the saved question's words, most specific first, into textareas too", () => {
    const p: Profile = {
      ...withAnswers,
      applicationAnswers: {
        customAnswers: [
          { id: "a", question: "hear", answer: "wrong" },
          { id: "b", question: "Why do you want to work here", answer: "Because of the mission." },
        ],
      },
    };
    const field: DetectedField = {
      selector: "#w",
      type: "textarea",
      label: "Why do you want to work here at Discord?",
    };
    expect(mapProfileToFields([field], p)).toEqual([{ selector: "#w", value: "Because of the mission." }]);
  });

  it("legacy additionalQuestions still answer matching questions", () => {
    const p: Profile = { ...baseProfile, additionalQuestions: { "Are you open to contract roles": "Yes" } };
    const field: DetectedField = { selector: "#c", type: "text", label: "Are you open to contract roles?" };
    expect(mapProfileToFields([field], p)).toEqual([{ selector: "#c", value: "Yes" }]);
  });

  it("option helpers", () => {
    expect(optionMatchesText("LinkedIn Jobs", "LinkedIn")).toBe(true);
    expect(optionMatchesText("No, I don't need a visa", "No")).toBe(true);
    expect(optionMatchesText("Company website", "LinkedIn")).toBe(false);
    expect(pickOption(["Yes", "No"], { value: "maybe" })).toBeUndefined();
  });

  it("a privacy-notice consent is never taken for a notice-period question", () => {
    const field: DetectedField = { selector: "#c", type: "checkbox", label: "I have read the privacy notice" };
    expect(recurringAnswer(field, withAnswers)).toBeUndefined();
  });
});

describe("main world: decline sentinel", () => {
  it("picks the decline option in a <select>", async () => {
    document.body.innerHTML = `<label for="g">Gender</label><select id="g"><option value="">Select</option><option value="1">Male</option><option value="2">Female</option><option value="3">Decline To Self Identify</option></select>`;
    const r = await mainWorldFill({ values: { "#g": DECLINE_SENTINEL } });
    expect(r.filled).toBe(1);
    expect((document.getElementById("g") as HTMLSelectElement).value).toBe("3");
  });

  it("never types the sentinel into a text box, and a select without a decline option stays empty", async () => {
    document.body.innerHTML = `<input id="t" type="text"><select id="s"><option value="">Select</option><option value="m">Male</option></select>`;
    const r = await mainWorldFill({ values: { "#t": DECLINE_SENTINEL, "#s": DECLINE_SENTINEL } });
    expect(r.filled).toBe(0);
    expect((document.getElementById("t") as HTMLInputElement).value).toBe("");
    expect((document.getElementById("s") as HTMLSelectElement).value).toBe("");
  });

  it("ticks only the decline radio", async () => {
    document.body.innerHTML = `<fieldset><legend>Veteran status</legend>
      <label><input type="radio" name="v" id="v1"> I am a protected veteran</label>
      <label><input type="radio" name="v" id="v2"> I don't wish to answer</label></fieldset>`;
    await mainWorldFill({ values: { "#v1": DECLINE_SENTINEL, "#v2": DECLINE_SENTINEL } });
    expect((document.getElementById("v1") as HTMLInputElement).checked).toBe(false);
    expect((document.getElementById("v2") as HTMLInputElement).checked).toBe(true);
  });

  it("ticks every accepted work mode in a checkbox group", async () => {
    document.body.innerHTML = `<label><input type="checkbox" id="c1" value="a"> Remote</label><label><input type="checkbox" id="c2" value="b"> On-site</label>`;
    await mainWorldFill({ values: { "#c1": "Remote" } });
    expect((document.getElementById("c1") as HTMLInputElement).checked).toBe(true);
    expect((document.getElementById("c2") as HTMLInputElement).checked).toBe(false);
  });
});

describe("Save this answer", () => {
  it("offers the questions autofill left open, not contact fields or voluntary questions", async () => {
    const { questionsLeftForUser } = await import("../src/lib/read-values");
    const { fields, mapped } = fill("greenhouse-discord", HOSTS.greenhouse, baseProfile);
    const left = questionsLeftForUser(fields, new Set(mapped.map((m) => m.selector)));
    const labels = left.map((f) => f.label);
    expect(labels).toContain("How did you hear about this job?");
    expect(labels).toContain("Why do you want to work at Discord?");
    expect(labels.some((l) => /gender|race|veteran|disability|lgbtq|hispanic/i.test(l ?? ""))).toBe(false);
    expect(labels.some((l) => /first name|email|phone|linkedin/i.test(l ?? ""))).toBe(false);
    // Filled fields aren't offered again.
    const filled = new Set(mapped.map((m) => m.selector));
    expect(left.every((f) => !filled.has(f.selector))).toBe(true);
  });

  it("reads typed answers, chosen <select> options and react-select selections", async () => {
    const { readValuesInPage } = await import("../src/lib/read-values");
    document.body.innerHTML = `
      <input id="a" value=" LinkedIn ">
      <textarea id="b">Because.</textarea>
      <select id="c"><option value="">Select...</option><option value="2" selected>2 weeks</option></select>
      <select id="d"><option value="" selected>Select...</option></select>
      <div class="select__control"><div class="select__single-value">Referral</div><input id="e" role="combobox" value=""></div>
      <input id="f" value="">`;
    expect(readValuesInPage(["#a", "#b", "#c", "#d", "#e", "#f", "#missing", "::bad"])).toEqual({
      "#a": "LinkedIn",
      "#b": "Because.",
      "#c": "2 weeks",
      "#e": "Referral",
    });
  });
});
