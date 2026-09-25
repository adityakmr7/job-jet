import type { DetectedField, Profile } from "@job-jet/shared";
import { firstAndLastName, findLink, yesNo } from "./profile-utils";
import { parseLocation } from "./location";
import { getAdapter } from "./adapters";

/**
 * Heuristic tier of the layered autofill engine: matches a page's detected
 * fields against the user's saved profile purely by name/id/label keyword,
 * entirely client-side (no LLM round-trip). The known-site-adapter tier
 * (per-ATS selector maps) runs before it and the LLM-fallback tier after.
 *
 * Deliberately does NOT fill: voluntary EEO / demographic self-
 * identification fields (see NEVER_FILL) — opt-in disclosures the user
 * should answer themselves. Also doesn't attempt file inputs here (the
 * side panel attaches the stored resume separately) or free-text fields
 * with no profile-backed source (salary, notice period, "how did you hear").
 *
 * Every rule below was tightened after a live run against real Greenhouse,
 * Lever, Ashby and Workable postings found it firing on the wrong
 * question (see the regression fixtures in tests/fixtures/portals).
 */

export function fieldText(field: DetectedField): string {
  return [field.question, field.label, field.name, field.id, field.placeholder]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function matches(field: DetectedField, ...patterns: RegExp[]): boolean {
  const text = fieldText(field);
  return patterns.some((p) => p.test(text));
}

/** Explicitly excluded from autofill (every tier, LLM included) even if a
 *  pattern would otherwise match: voluntary EEO / demographic questions and
 *  other sensitive disclosures. Found live: a Greenhouse "Do you identify as
 *  a member of the LGBTQ+ community?" question slipped past the old list and
 *  was sent to the LLM tier. */
export const NEVER_FILL = new RegExp(
  [
    "pronoun",
    "veteran",
    "military (status|service|spouse)",
    "disabilit",
    "handicap",
    "ethnic",
    "\\bgender\\b",
    "\\bsex\\b",
    "\\brace\\b",
    "racial",
    "lgbt",
    "sexual",
    "orientation",
    "transgender",
    "\\btrans\\b",
    "non-?binary",
    "hispanic",
    "latin[oax]",
    "heritage",
    "religio",
    "marital",
    "national origin",
    "date of birth",
    "birth ?date",
    "\\bage\\b",
    "social security",
    "\\bssn\\b",
    "criminal",
    "convict",
    "self[- ]?identif",
    "demographic",
    "\\bcaste\\b",
  ].join("|"),
  "i"
);

const CHOICE_TYPES = new Set(["radio", "checkbox", "yesno"]);

// Label-only view for rules that must not be fooled by name/id.
function labelText(field: DetectedField): string {
  return (field.question ?? field.label ?? "").toLowerCase();
}

/** Open-ended / essay wording — never a place for a bare profile value. */
const ESSAY = /\b(share|describe|tell us|explain|example|why|how would|what would|contribution|walk us|elaborate|motivat)/i;

function isEssayLike(field: DetectedField): boolean {
  const label = labelText(field);
  return ESSAY.test(label) || label.length > 80;
}

/** "Name" fields that are someone else's name, not the applicant's. Found
 *  live: Linear's "Has someone at Linear referred you? ... include their
 *  name" and BambooHR's "legal name while working at BambooHR previously"
 *  both got the applicant's full name. */
const NOT_OWN_NAME =
  /refer|recruit|previous|former|prior|emergency|reference|manager|supervisor|their name|contact|spouse|relative|family|parent|guardian|company|school|employer|universit|institution|user|file|nick|maiden|preferred|first|last|middle|sur|given|business|org/i;

/** Company fields that aren't "where do you work now". Found latent: the
 *  old /\b(employer|company)\b/ rule fired on "Company size preference". */
const NOT_CURRENT_COMPANY =
  /size|industry|type|stage|prefer|culture|values|why|website|url|domain|revenue|funding|sector|founded|headcount|employees|hear|refer|previous|former|past|dream|target|like to work|interest|worked (for|at)|ever (been|worked)|relationship|family|competitor|name of (the )?compan(y|ies) you/i;

export interface MapResult {
  selector: string;
  value: string;
}

/** Answer for a Yes/No-style question from the profile, if the question is
 *  one the profile actually answers. Sponsorship is checked before work
 *  authorization: "Do you need a visa or work permit?" mentions a work
 *  permit but is a sponsorship question (live on a Lever EU posting). */
export function yesNoAnswer(field: DetectedField, profile: Profile): string | undefined {
  if (matches(field, SPONSORSHIP)) return yesNo(profile.workAuthorization?.requiresSponsorship);
  if (matches(field, WORK_AUTH)) return yesNo(profile.workAuthorization?.authorizedToWork);
  return undefined;
}

const SPONSORSHIP =
  /sponsor|require.{0,40}visa|visa.{0,20}(status|required|needed|support)|need.{0,20}(a )?(visa|work permit)|petition|employment.?based (visa|status|immigration)|immigration (support|sponsorship|status)|h-?1b/i;
const WORK_AUTH =
  /authori[sz].{0,40}work|work.{0,40}authori[sz]|right.{0,10}to.{0,10}work|work.?permit|eligib.{0,40}work|legally.{0,30}(work|employ)|permitted to work|entitled to work/i;

type Polarity = "yes" | "no" | undefined;
function polarity(text: string | undefined): Polarity {
  const t = (text ?? "").trim().toLowerCase();
  if (/^(yes|y|true)\b/.test(t)) return "yes";
  if (/^(no|n|false)\b/.test(t)) return "no";
  return undefined;
}

/** Choice fields (radio / checkbox / Ashby Yes/No buttons): only the option
 *  that actually matches the answer is emitted. The old code gave every
 *  radio of a group the same "Yes" and let the last one win. */
function mapChoiceField(field: DetectedField, profile: Profile): string | undefined {
  if (!field.question && field.type !== "yesno") {
    // A lone checkbox whose own label is the statement
    // ("I am legally authorized to work in the US") — tick it only when the
    // profile answers yes; never untick or answer no by leaving a mark.
    const answer = yesNoAnswer(field, profile);
    return answer === "Yes" && field.type === "checkbox" ? "Yes" : undefined;
  }
  const answer = yesNoAnswer(field, profile);
  if (!answer) return undefined;
  if (field.type === "yesno") return answer;
  const option = polarity(field.label);
  return option && option === polarity(answer) ? answer : undefined;
}

function yearsOfExperience(profile: Profile): string | undefined {
  const starts = profile.experience
    .map((e) => e.startDate)
    .filter((d): d is string => !!d && /^\d{4}/.test(d))
    .map((d) => Number(d.slice(0, 4)));
  if (starts.length === 0) return undefined;
  const years = new Date().getFullYear() - Math.min(...starts);
  return years > 0 ? String(years) : undefined;
}

export function mapProfileToFields(fields: DetectedField[], profile: Profile): MapResult[] {
  const { first, last } = firstAndLastName(profile.fullName);
  const linkedin = findLink(profile, "linkedin");
  const github = findLink(profile, "github");
  const portfolio = findLink(profile, "portfolio", "website");
  const mostRecentJob = profile.experience[0];
  const mostRecentEducation = profile.education[0];
  const loc = parseLocation(profile.location);
  // Lever/Greenhouse forms often have both "Portfolio URL"/"Website" and an
  // "Other website" field — found live: both got the same URL.
  const WEBSITE = /portfolio|personal.?(website|site)|\bwebsite\b|\bblog\b/i;
  const hasMainWebsiteField = fields.some((f) => matches(f, WEBSITE) && !matches(f, /\bother\b/i));

  const results: MapResult[] = [];

  for (const field of fields) {
    if (field.type === "file") continue; // resume attach is a separate step
    if (matches(field, NEVER_FILL)) continue;

    if (CHOICE_TYPES.has(field.type)) {
      const value = mapChoiceField(field, profile);
      if (value) results.push({ selector: field.selector, value });
      continue;
    }

    const label = labelText(field);
    let value: string | undefined;

    // "Legal Name" is Ashby's actual label for this field on a real, live
    // posting; "full name" alone missed it. Bare "Name" is accepted only as
    // a short label that isn't somebody else's name.
    const nameLike =
      matches(field, /full.?name|legal.?name|your name/i) || (matches(field, /\bname\b/i) && label.length <= 40);
    if (nameLike && !matches(field, NOT_OWN_NAME) && field.type !== "textarea") {
      value = profile.fullName;
    } else if (matches(field, /first.?name|given.?name/i) && !matches(field, /\brefer|emergency|reference|manager|spouse|preferred|nick/i)) {
      value = first;
    } else if (matches(field, /last.?name|family.?name|surname/i) && !matches(field, /\brefer|emergency|reference|manager|spouse|preferred/i)) {
      value = last;
    } else if (field.type === "email" || matches(field, /e-?mail/i)) {
      value = matches(field, /refer|reference|manager/i) ? undefined : profile.email;
    } else if (field.type === "tel" || matches(field, /phone|mobile/i)) {
      value = matches(field, /refer|reference|emergency/i) ? undefined : profile.phone;
    } else if (yesNoAnswer(field, profile) !== undefined && (field.type === "select" || field.type === "text")) {
      // Work authorization / sponsorship as a dropdown (Greenhouse
      // react-select, Lever <select>) or short text answer.
      value = yesNoAnswer(field, profile);
    } else if (matches(field, /linkedin/i)) {
      value = isEssayLike(field) ? undefined : linkedin;
    } else if (matches(field, /github/i)) {
      // Only a GitHub profile/URL field — found live on Workable: "Share 2–3
      // of your open-source contributions with links (GitHub PRs…)" got the
      // bare profile URL.
      const profileField = label.length <= 30 || /url|profile|link|username|handle|account/.test(label);
      value = profileField && !isEssayLike(field) ? github : undefined;
    } else if (matches(field, WEBSITE)) {
      const duplicate = matches(field, /\bother\b/i) && hasMainWebsiteField;
      value = isEssayLike(field) || field.type === "textarea" || duplicate ? undefined : portfolio ?? github;
    } else if (matches(field, /street|address.?line|\baddress\b|zip|postal|post.?code/i)) {
      // A free-form location is never a street address or a zip code.
      value = undefined;
    } else if (matches(field, /\bcity\b|\btown\b/i) && !matches(field, /ethnicity|capacity/i)) {
      value = loc.city;
    } else if (/^\s*(state|province|region)\b/.test(label) || /^(state|province)$/i.test(field.name ?? field.id ?? "")) {
      value = loc.state;
    } else if (matches(field, /country/i) && label.length <= 60 && !isEssayLike(field)) {
      value = loc.country;
    } else if (
      matches(
        field,
        /location|where.{0,30}(located|based|live|reside)|where.{0,40}(work(ing)? from|intend to work|plan(ning)? (to|on) work)|current.?city|based in/i
      ) &&
      !isEssayLike(field) &&
      !matches(field, /prefer|willing|relocat|open to|office|timezone|time zone/i)
    ) {
      // A "What is your location?" <select> of countries (Lever/Spotify)
      // takes the derived country, not the free-form city string.
      const countryOption =
        field.type === "select" && loc.country
          ? field.options?.find((o) => o.trim().toLowerCase().startsWith(loc.country!.toLowerCase()))
          : undefined;
      value = countryOption ? loc.country : profile.location;
    } else if (matches(field, /cover.?letter/i) && field.type === "textarea") {
      value = profile.summary;
    } else if (
      matches(field, /\b(employer|company)\b/i) &&
      !matches(field, NOT_CURRENT_COMPANY) &&
      label.length <= 60 &&
      field.type !== "textarea" &&
      mostRecentJob
    ) {
      value = mostRecentJob.company;
    } else if (
      matches(field, /job.?title|\btitle\b/i) &&
      !matches(field, /prefix|salutation|desired|preferred|position you|applying/i) &&
      label.length <= 60 &&
      field.type !== "textarea" &&
      mostRecentJob
    ) {
      value = mostRecentJob.title;
    } else if (matches(field, /years.*experience/i) && field.type !== "textarea") {
      value = yearsOfExperience(profile);
    } else if (matches(field, /school|university|college|institution/i) && label.length <= 60 && mostRecentEducation) {
      value = mostRecentEducation.school;
    } else if (matches(field, /degree/i) && label.length <= 60 && mostRecentEducation) {
      value = mostRecentEducation.degree;
    } else if (matches(field, /discipline|field.?of.?study|\bmajor\b/i) && mostRecentEducation) {
      value = mostRecentEducation.fieldOfStudy;
    }

    if (value) results.push({ selector: field.selector, value });
  }

  return results;
}

/**
 * Composes tier 2 (known-site adapter) over tier 1 (heuristic): the
 * adapter for `hostname`, if one exists, gets first say on its core
 * fields; the heuristic then runs only on whatever fields the adapter
 * didn't claim, so a field is never filled twice via two different
 * selectors pointing at the same element.
 */
export function runAutofillMapping(fields: DetectedField[], profile: Profile, hostname: string): MapResult[] {
  const adapter = getAdapter(hostname);
  const adapterResults = adapter?.mapFields(fields, profile) ?? [];

  const claimed = new Set(adapterResults.map((r) => r.selector));
  const remainingFields = fields.filter((f) => !claimed.has(f.selector));
  const heuristicResults = mapProfileToFields(remainingFields, profile);

  return [...adapterResults, ...heuristicResults];
}

function groupKey(field: DetectedField): string | undefined {
  if (!CHOICE_TYPES.has(field.type)) return undefined;
  return field.question ? `q:${field.frameId ?? 0}:${field.question}` : field.name ? `n:${field.frameId ?? 0}:${field.name}` : undefined;
}

/** Fields left for the LLM tier after tiers 1+2: not already mapped, not a
 *  file, not NEVER_FILL, and not another option of a radio/checkbox group
 *  that already got its answer. */
export function unresolvedFields(fields: DetectedField[], mapped: MapResult[]): DetectedField[] {
  const claimed = new Set(mapped.map((m) => m.selector));
  const answeredGroups = new Set(
    fields.filter((f) => claimed.has(f.selector)).map(groupKey).filter((k): k is string => !!k)
  );
  return fields.filter((f) => {
    if (claimed.has(f.selector) || f.type === "file" || matches(f, NEVER_FILL)) return false;
    const key = groupKey(f);
    return !(key && answeredGroups.has(key));
  });
}

/** Shape a field for the LLM endpoint: a choice option's question is folded
 *  into its label (the endpoint only knows `label`), and frame bookkeeping
 *  is dropped. Labels are capped to the endpoint's 500-char limit. */
export function toLlmField(field: DetectedField): DetectedField {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { question, frameId, ...rest } = field;
  const label = question && question !== field.label ? `${question} — ${field.label ?? ""}` : field.label;
  return { ...rest, label: label?.slice(0, 500) };
}
