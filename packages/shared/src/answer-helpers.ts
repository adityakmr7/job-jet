/**
 * Saved-answer helpers with no runtime dependencies (no zod), so the
 * extension can import them without bundling the schemas. The schemas
 * live in answers.ts.
 */
import type { ApplicationAnswers, CountryWorkAuth, CustomAnswer } from "./answers";

export const ANSWER_LIMITS = {
  shortAnswer: 200,
  customQuestion: 200,
  customAnswer: 2_000,
  customAnswers: 50,
  countries: 30,
} as const;

/** Strips control characters (keeps newlines/tabs) and trims. Applied to
 *  every saved-answer string before it's stored or typed into a form. */
export function sanitizeAnswerText(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
}

export const WORK_MODES = ["remote", "hybrid", "onsite"] as const;
export type WorkMode = (typeof WORK_MODES)[number];

export const SALARY_PERIODS = ["year", "month", "hour"] as const;
export type SalaryPeriod = (typeof SALARY_PERIODS)[number];

/** A voluntary demographic answer: unset (never filled, the default),
 *  DECLINE_ANSWER (pick the form's "decline / prefer not to say" option),
 *  or a literal answer the user typed (matched against the form's options). */
export const DECLINE_ANSWER = "decline";

export const DEMOGRAPHIC_KEYS = [
  "gender",
  "raceEthnicity",
  "hispanicLatino",
  "veteranStatus",
  "disabilityStatus",
  "lgbtq",
  "transgender",
  "sexualOrientation",
] as const;
export type DemographicKey = (typeof DEMOGRAPHIC_KEYS)[number];

// ---------------------------------------------------------------------------
// Country detection (country-specific work authorization)
// ---------------------------------------------------------------------------

/** Canonical country name -> pattern that names it in a question. The
 *  patterns run on the original-case text, so "US" (the country) isn't
 *  confused with "us" (the pronoun). */
const COUNTRY_PATTERNS: [string, RegExp][] = [
  // Case-sensitive on purpose: "US" is the country, "us" the pronoun.
  ["United States", /\b(?:[Uu]nited [Ss]tates|UNITED STATES|U\.S\.(?:A\.)?|USA|US|[Aa]merica)(?![A-Za-z])/],
  ["United Kingdom", /\b(united kingdom|U\.K\.|UK|great britain|britain|england|scotland|wales)\b/i],
  ["Canada", /\bcanad(a|ian)\b/i],
  ["India", /\bindia\b/i],
  ["Poland", /\bpol(and|ish)\b/i],
  ["Germany", /\bgerman(y)?\b/i],
  ["France", /\bfrance\b/i],
  ["Netherlands", /\b(netherlands|holland)\b/i],
  ["Ireland", /\bireland\b/i],
  ["Spain", /\bspain\b/i],
  ["Portugal", /\bportugal\b/i],
  ["Italy", /\bitaly\b/i],
  ["Sweden", /\bsweden\b/i],
  ["Denmark", /\bdenmark\b/i],
  ["Norway", /\bnorway\b/i],
  ["Finland", /\bfinland\b/i],
  ["Switzerland", /\bswitzerland\b/i],
  ["Austria", /\baustria\b/i],
  ["Belgium", /\bbelgium\b/i],
  ["Czech Republic", /\b(czech republic|czechia)\b/i],
  ["Romania", /\bromania\b/i],
  ["Australia", /\baustralia\b/i],
  ["New Zealand", /\bnew zealand\b/i],
  ["Singapore", /\bsingapore\b/i],
  ["Japan", /\bjapan\b/i],
  ["Brazil", /\bbrazil\b/i],
  ["Mexico", /\bmexico\b/i],
  ["Israel", /\bisrael\b/i],
  ["United Arab Emirates", /\b(united arab emirates|UAE|dubai)\b/i],
  ["European Union", /\b(?:[Ee]uropean [Uu]nion|EU|EEA)\b/],
];

/** Ways users type a country in their saved list -> canonical name. */
const COUNTRY_ALIASES: Record<string, string> = {
  us: "United States",
  usa: "United States",
  "u.s.": "United States",
  "u.s.a.": "United States",
  america: "United States",
  "united states of america": "United States",
  uk: "United Kingdom",
  "u.k.": "United Kingdom",
  "great britain": "United Kingdom",
  britain: "United Kingdom",
  england: "United Kingdom",
  holland: "Netherlands",
  "the netherlands": "Netherlands",
  czechia: "Czech Republic",
  uae: "United Arab Emirates",
  eu: "European Union",
  eea: "European Union",
};

export function canonicalCountry(name: string): string {
  const key = name.trim().toLowerCase();
  if (COUNTRY_ALIASES[key]) return COUNTRY_ALIASES[key];
  const hit = COUNTRY_PATTERNS.find(([canonical]) => canonical.toLowerCase() === key);
  return hit ? hit[0] : name.trim();
}

/** Countries a question names, canonical, in order of first appearance. */
export function detectCountries(text: string): string[] {
  const found: { name: string; at: number }[] = [];
  for (const [name, pattern] of COUNTRY_PATTERNS) {
    const m = pattern.exec(text);
    if (m) found.push({ name, at: m.index });
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.name);
}

export interface WorkAuthAnswer {
  authorizedToWork?: boolean;
  requiresSponsorship?: boolean;
}

/**
 * The work-authorization answer for a question:
 * - it names a country with a saved entry -> that entry;
 * - it names a country without an entry while the user keeps a
 *   per-country list -> nothing (we don't guess from another country);
 * - it names no country ("the country where the job is located"), or the
 *   user never added per-country answers -> the default (the profile's
 *   top-level workAuthorization), exactly as before.
 */
export function workAuthFor(
  questionText: string,
  defaults: WorkAuthAnswer | undefined,
  byCountry: CountryWorkAuth[] | undefined
): WorkAuthAnswer | undefined {
  const entries = byCountry ?? [];
  const named = detectCountries(questionText);
  if (named.length === 0 || entries.length === 0) return defaults;
  for (const country of named) {
    const entry = entries.find((e) => canonicalCountry(e.country) === country);
    if (entry) return { authorizedToWork: entry.authorizedToWork, requiresSponsorship: entry.requiresSponsorship };
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Notice period / start date / salary / custom answers
// ---------------------------------------------------------------------------

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  eight: 8,
  twelve: 12,
};

/** Approximate notice period in days: "Immediately" -> 0, "2 weeks" -> 14,
 *  "1 month" -> 30, "3 months" -> 90. Undefined when it can't be read. */
export function noticePeriodDays(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const t = text.toLowerCase();
  if (/\b(immediate(ly)?|asap|right away|no notice|none|0 ?days?)\b/.test(t)) return 0;
  const m = /(\d+(?:\.\d+)?|one|two|three|four|five|six|eight|twelve)[\s-]*(day|week|month)/.exec(t);
  if (!m) return undefined;
  const n = NUMBER_WORDS[m[1]] ?? Number(m[1]);
  const unit = m[2] === "day" ? 1 : m[2] === "week" ? 7 : 30;
  return Math.round(n * unit);
}

/** The one option whose notice period equals the saved one, if any. */
export function matchNoticeOption(options: string[], saved: string | undefined): string | undefined {
  const want = noticePeriodDays(saved);
  if (want === undefined) return undefined;
  const hits = options.filter((o) => noticePeriodDays(o) === want);
  return hits.length === 1 ? hits[0] : undefined;
}

/** Earliest start date for a form field: ISO for native date inputs,
 *  MM/DD/YYYY for date-picker text boxes, a readable date otherwise. */
export function formatStartDate(iso: string | undefined, style: "iso" | "us" | "text"): string | undefined {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const [y, m, d] = iso.split("-");
  if (style === "iso") return iso;
  if (style === "us") return `${m}/${d}/${y}`;
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${months[Number(m) - 1]} ${Number(d)}, ${y}`;
}

/** Salary answer for a question, converting year <-> month when the
 *  question asks for the other period (hourly is never converted). A bare
 *  number for numeric inputs and "numbers only" questions that don't also
 *  ask for the currency. */
export function salaryAnswer(
  salary: ApplicationAnswers["salary"],
  questionText: string,
  opts: { numericOnly?: boolean } = {}
): string | undefined {
  if (!salary) return undefined;
  const q = questionText.toLowerCase();
  const asked: SalaryPeriod | undefined = /\bmonth(ly)?\b/.test(q)
    ? "month"
    : /\b(year(ly)?|annual(ly)?|per annum|p\.a\.)/.test(q)
      ? "year"
      : /\bhour(ly)?\b/.test(q)
        ? "hour"
        : undefined;
  let amount = salary.amount;
  let period: SalaryPeriod = salary.period;
  if (asked && asked !== period) {
    if (asked === "month" && period === "year") amount = amount / 12;
    else if (asked === "year" && period === "month") amount = amount * 12;
    else return undefined;
    period = asked;
  }
  const rounded = String(Math.round(amount));
  if (opts.numericOnly) return rounded;
  if (/numbers? only/.test(q) && !/currency/.test(q)) return rounded;
  return asked ? `${rounded} ${salary.currency}` : `${rounded} ${salary.currency} per ${period}`;
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "you",
  "your",
  "are",
  "is",
  "do",
  "did",
  "does",
  "to",
  "of",
  "for",
  "in",
  "on",
  "at",
  "with",
  "and",
  "or",
  "what",
  "how",
  "please",
  "this",
  "that",
  "our",
  "we",
  "us",
  "be",
  "if",
  "any",
  "have",
]);

function contentTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOP_WORDS.has(t));
}

/** The saved custom answer whose question matches `questionText`: every
 *  meaningful word of the saved question appears in the form's question.
 *  The most specific (most words) saved question wins. */
export function findCustomAnswer(questionText: string, answers: CustomAnswer[] | undefined): CustomAnswer | undefined {
  if (!answers?.length) return undefined;
  const have = new Set(contentTokens(questionText));
  let best: { a: CustomAnswer; score: number } | undefined;
  for (const a of answers) {
    const want = contentTokens(a.question);
    if (want.length === 0) continue;
    if (want.every((w) => have.has(w)) && (!best || want.length > best.score)) best = { a, score: want.length };
  }
  return best?.a;
}

/** Custom answers plus the legacy `additionalQuestions` record (older
 *  profiles), saved custom answers first. */
export function allCustomAnswers(
  answers: ApplicationAnswers | undefined,
  legacy: Record<string, string> | undefined | null
): CustomAnswer[] {
  const legacyAnswers = Object.entries(legacy ?? {})
    .filter(([q, a]) => q.trim() && a.trim())
    .map(([question, answer], i) => ({ id: `legacy-${i}`, question, answer }));
  return [...(answers?.customAnswers ?? []), ...legacyAnswers];
}

/** Years of experience: the saved answer if set, otherwise whole years
 *  since the earliest dated role. */
export function yearsOfExperienceFor(
  experience: { startDate?: string }[],
  saved: number | undefined,
  now: Date = new Date()
): string | undefined {
  if (saved !== undefined) return String(saved);
  const starts = experience
    .map((e) => e.startDate)
    .filter((d): d is string => !!d && /^\d{4}/.test(d))
    .map((d) => Number(d.slice(0, 4)));
  if (starts.length === 0) return undefined;
  const years = now.getFullYear() - Math.min(...starts);
  return years > 0 ? String(years) : undefined;
}

export const WORK_MODE_LABELS: Record<WorkMode, string> = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site" };
