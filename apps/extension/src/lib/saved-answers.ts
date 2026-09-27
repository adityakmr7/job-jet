// The zod-free entry point: importing "@job-jet/shared" for runtime
// values would bundle every schema (and zod) into the extension.
import {
  DECLINE_ANSWER,
  allCustomAnswers,
  findCustomAnswer,
  formatStartDate,
  matchNoticeOption,
  noticePeriodDays,
  salaryAnswer,
  yearsOfExperienceFor,
  type DemographicKey,
  type WorkMode,
} from "@job-jet/shared/answer-helpers";
import type { ApplicationAnswers, DetectedField, Profile } from "@job-jet/shared";

/**
 * Autofill from the user's saved answers (Profile -> Saved answers): how
 * did you hear, notice period / start date, salary, relocation, work mode,
 * years of experience, custom Q&A and — only when the user explicitly set
 * them — voluntary demographic answers.
 *
 * An answer is either a value typed as-is (text inputs, type-to-search
 * comboboxes whose options aren't known yet) or, when the field's options
 * are known (a <select>, a radio's own label), the one option that
 * matches. No match -> the field is left alone.
 */

/** Sent to the main-world filler for "decline to answer": it picks the
 *  form's decline / prefer-not-to-say option and never types this text. */
export const DECLINE_SENTINEL = "__jobjet_decline__";

export interface SavedAnswer {
  /** Value to type, or the Yes/No answer for a Yes/No question. */
  value: string;
  /** Picks a matching option by its text. Defaults to a text match on
   *  `value` (and Yes/No polarity for "Yes"/"No"). */
  option?: (optionText: string) => boolean;
}

export function answersOf(profile: Profile): ApplicationAnswers {
  // The API returns null for unset jsonb columns.
  return profile.applicationAnswers ?? {};
}

/** Original-case question text (country detection needs "US" vs "us"). */
export function questionText(field: DetectedField): string {
  return (field.question ?? field.label ?? field.placeholder ?? "").trim();
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9+\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type Polarity = "yes" | "no" | undefined;
export function polarity(text: string | undefined): Polarity {
  const t = (text ?? "").trim().toLowerCase();
  if (/^(yes|y|true)\b/.test(t)) return "yes";
  if (/^(no|n|false)\b/.test(t)) return "no";
  return undefined;
}

/** Does an option's text match a saved text answer? Exact, a word-bounded
 *  prefix either way ("LinkedIn" ~ "LinkedIn Jobs"), or Yes/No polarity. */
export function optionMatchesText(option: string, value: string): boolean {
  const o = norm(option);
  const v = norm(value);
  if (!o || !v) return false;
  if (o === v) return true;
  const pv = polarity(value);
  if (pv && (v === "yes" || v === "no")) return polarity(option) === pv;
  if (o.startsWith(v + " ") || v.startsWith(o + " ")) return true;
  return v.length >= 4 && new RegExp(`\\b${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(o);
}

/** The single option that matches, or undefined when none/ambiguous. */
export function pickOption(options: string[], answer: SavedAnswer): string | undefined {
  const test = answer.option ?? ((o: string) => optionMatchesText(o, answer.value));
  const hits = options.filter((o) => o.trim() && test(o));
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) {
    const exact = hits.filter((o) => norm(o) === norm(answer.value));
    if (exact.length === 1) return exact[0];
  }
  return undefined;
}

// --- voluntary demographics ------------------------------------------------

const DECLINE_OPTION =
  /decline|prefer not|rather not|do not wish|don.?t wish|not wish to|choose not|not to (say|answer|disclose|self)|wish not/i;

export function isDeclineOption(text: string): boolean {
  return DECLINE_OPTION.test(text);
}

/** Which voluntary disclosure a question is, most specific first. */
export function demographicCategory(field: DetectedField): DemographicKey | "pronouns" | undefined {
  const t = [field.question, field.label, field.name, field.id].filter(Boolean).join(" ").toLowerCase();
  if (/pronoun/.test(t)) return "pronouns";
  if (/lgbt/.test(t)) return "lgbtq";
  if (/transgender|\btrans\b/.test(t)) return "transgender";
  if (/sexual orientation|\borientation\b/.test(t)) return "sexualOrientation";
  if (/hispanic|latin[oax]/.test(t)) return "hispanicLatino";
  if (/\brace\b|racial|ethnic/.test(t)) return "raceEthnicity";
  if (/veteran|military (status|service)/.test(t)) return "veteranStatus";
  if (/disabilit|handicap/.test(t)) return "disabilityStatus";
  if (/\bgender\b|\bsex\b/.test(t)) return "gender";
  return undefined;
}

/** The user's explicit answer for a voluntary demographic question, or
 *  undefined (the default: never filled). */
export function demographicAnswer(field: DetectedField, profile: Profile): SavedAnswer | undefined {
  const category = demographicCategory(field);
  if (!category) return undefined;
  const answers = answersOf(profile);
  const saved = category === "pronouns" ? answers.pronouns : answers.demographics?.[category];
  if (!saved) return undefined;
  if (saved === DECLINE_ANSWER) return { value: DECLINE_SENTINEL, option: isDeclineOption };
  return { value: saved };
}

// --- recurring questions ---------------------------------------------------

export const REFERRAL =
  /how did you (hear|find|learn|come across)|hear about|where did you (hear|find|see|learn)|referral source|source of (your )?application|how were you referred/i;
const NOTICE =
  /notice period|period of notice|notice required|how soon|when (can|could|would) you (start|join|begin)|(desired|earliest|available|possible|preferred|expected|proposed) (start(ing)?|joining) date|earliest.{0,20}(start|join)|available to (start|join)|\bavailability\b|date available/i;
const SALARY = /salary|compensation|pay expectation|expected (pay|rate|ctc)|desired (pay|rate)|\bctc\b|remuneration/i;
const RELOCATE = /relocat/i;
const WORK_MODE_Q =
  /work(ing)? (mode|arrangement|model|setup|style|location preference)|remote|hybrid|on-?site|in[- ]office|from (our|the) .{0,30}office|office .{0,20}days|days .{0,20}(in|per week).{0,20}office/i;
const YEARS = /years.{0,30}experience|experience.{0,20}years/i;
const ESSAY = /\b(share|describe|tell us|explain|example|why|how would|what would|walk us|elaborate|motivat)/i;

const MODE_PATTERNS: Record<WorkMode, RegExp> = {
  remote: /remote|work from home|wfh|distributed/i,
  hybrid: /hybrid|days? (a|per) week|flexible/i,
  onsite: /on-?site|in[- ]office|in person|office/i,
};

function modeOf(text: string): WorkMode | undefined {
  // Hybrid first: "hybrid (3 days in office)" mentions the office too.
  for (const mode of ["hybrid", "remote", "onsite"] as WorkMode[]) if (MODE_PATTERNS[mode].test(text)) return mode;
  return undefined;
}

function isChoice(field: DetectedField): boolean {
  return field.type === "radio" || field.type === "checkbox" || field.type === "yesno";
}

function looksLikeDatePicker(field: DetectedField): boolean {
  return field.type === "date" || /pick (a )?date|mm\s*\/\s*dd|dd\s*\/\s*mm|yyyy/i.test(field.placeholder ?? "");
}

/** Saved start date if it's still in the future, otherwise today plus the
 *  notice period (so a saved notice period never goes stale). */
function startDateIso(answers: ApplicationAnswers, now: Date): string | undefined {
  const today = now.toISOString().slice(0, 10);
  if (answers.earliestStartDate && answers.earliestStartDate >= today) return answers.earliestStartDate;
  const days = noticePeriodDays(answers.noticePeriod);
  if (days === undefined) return undefined;
  return new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

/** Answer for one of the recurring questions, if the question is one and
 *  the user saved an answer for it. `now` is injectable for tests. */
export function recurringAnswer(
  field: DetectedField,
  profile: Profile,
  now: Date = new Date()
): SavedAnswer | undefined {
  const answers = answersOf(profile);
  const q = questionText(field);
  const text = [q, field.name, field.placeholder].filter(Boolean).join(" ");
  const essay = ESSAY.test(q) || q.length > 200;

  if (REFERRAL.test(text) && !/\bname\b|who referred|employee/i.test(q)) {
    return answers.referralSource ? { value: answers.referralSource } : undefined;
  }

  if (SALARY.test(text) && !essay && field.type !== "textarea") {
    if (isChoice(field) || field.type === "select") return undefined; // ranges: left to the user
    const value = salaryAnswer(answers.salary, q, { numericOnly: field.type === "number" });
    return value ? { value } : undefined;
  }

  if (NOTICE.test(text) && !essay) {
    if (looksLikeDatePicker(field)) {
      const iso = startDateIso(answers, now);
      const value = formatStartDate(iso, field.type === "date" ? "iso" : "us");
      return value ? { value } : undefined;
    }
    if (answers.noticePeriod) {
      return { value: answers.noticePeriod, option: (o) => matchNoticeOption([o], answers.noticePeriod) === o };
    }
    const date = formatStartDate(startDateIso(answers, now), "text");
    return date ? { value: date } : undefined;
  }

  if (RELOCATE.test(q) && !essay) {
    if (answers.willingToRelocate === true) return { value: "Yes" };
    // "No" only for a plain relocation question — "based in or willing to
    // relocate" may still be a yes for someone who already lives there.
    if (answers.willingToRelocate === false && !/based|located|live|reside|currently/i.test(q)) return { value: "No" };
    return undefined;
  }

  if (WORK_MODE_Q.test(q) && !essay && answers.workModes?.length) {
    const modes = answers.workModes;
    const asked = modeOf(q);
    const isYesNo =
      field.type === "yesno" || polarity(field.label) !== undefined || /^(are|do|would|can|will|is)\b/i.test(q);
    // A Yes/No question about a work arrangement the user can accept, not
    // "Do you have experience working remotely?".
    if (
      isYesNo &&
      !/open to|willing|comfortable|able to|prefer|interested|okay|ok with|happy to|work from|commute|days/i.test(q)
    ) {
      return undefined;
    }
    if (isYesNo && asked) {
      // "Able to work from our office 3 days a week?" -> yes if the user
      // accepts hybrid or on-site; "open to remote?" -> yes if remote.
      const yes = asked === "onsite" ? modes.includes("onsite") || modes.includes("hybrid") : modes.includes(asked);
      const onlyOther = !yes && modes.length > 0;
      return yes ? { value: "Yes" } : onlyOther ? { value: "No" } : undefined;
    }
    // Options such as Remote / Hybrid / On-site: the most preferred one
    // (checkbox groups tick every accepted mode).
    const preferred = modes[0];
    return {
      value: preferred,
      option: (o) => {
        const m = modeOf(o);
        return field.type === "checkbox" ? !!m && modes.includes(m) : m === preferred;
      },
    };
  }

  if (YEARS.test(q) && field.type !== "textarea" && !essay) {
    const years = yearsOfExperienceFor(profile.experience, answers.yearsOfExperience, now);
    if (!years) return undefined;
    const n = Number(years);
    return { value: years, option: (o) => optionCoversNumber(o, n) };
  }

  return undefined;
}

/** "3-5 years", "5+", "Less than 2", "10 or more" contains n? */
export function optionCoversNumber(option: string, n: number): boolean {
  const t = option.toLowerCase();
  let m = /(\d+)\s*(?:-|–|to)\s*(\d+)/.exec(t);
  if (m) return n >= Number(m[1]) && n <= Number(m[2]);
  m = /(\d+)\s*(\+|or more|and above|plus)/.exec(t) ?? /(?:more than|over|at least)\s*(\d+)/.exec(t);
  if (m) return /more than|over/.test(t) ? n > Number(m[1]) : n >= Number(m[1]);
  m = /(?:less than|under|fewer than)\s*(\d+)/.exec(t);
  if (m) return n < Number(m[1]);
  m = /^\s*(\d+)\s*(years?)?\s*$/.exec(t);
  return !!m && Number(m[1]) === n;
}

/** The user's custom Q&A matching this question (legacy
 *  additionalQuestions included). */
export function customAnswer(field: DetectedField, profile: Profile): SavedAnswer | undefined {
  const hit = findCustomAnswer(questionText(field), allCustomAnswers(answersOf(profile), profile.additionalQuestions));
  return hit ? { value: hit.answer } : undefined;
}

/** Resolve a SavedAnswer to the value to emit for `field`, or undefined.
 *  - select with known options: the matching option's text;
 *  - radio/checkbox: the option's own label when it matches;
 *  - Ashby Yes/No buttons: the Yes/No answer;
 *  - anything else: the value itself (never the decline sentinel into a
 *    plain textarea). */
export function valueFor(field: DetectedField, answer: SavedAnswer): string | undefined {
  if (field.type === "yesno") {
    const p = polarity(answer.value);
    return p ? (p === "yes" ? "Yes" : "No") : undefined;
  }
  if (field.type === "radio" || field.type === "checkbox") {
    if (!field.question) return undefined;
    const label = field.label ?? "";
    const p = polarity(answer.value);
    const optionPolarity = polarity(label);
    if (
      p &&
      optionPolarity &&
      (answer.value.trim().toLowerCase() === "yes" || answer.value.trim().toLowerCase() === "no")
    ) {
      return optionPolarity === p ? answer.value : undefined;
    }
    const test = answer.option ?? ((o: string) => optionMatchesText(o, answer.value));
    return test(label) ? label : undefined;
  }
  if (field.type === "select" && field.options?.length) {
    return pickOption(field.options, answer);
  }
  if (answer.value === DECLINE_SENTINEL && field.type === "textarea") return undefined;
  return answer.value;
}
