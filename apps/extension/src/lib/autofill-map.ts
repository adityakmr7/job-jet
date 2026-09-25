import type { DetectedField, Profile } from "@job-jet/shared";
import { firstAndLastName, findLink, yesNo } from "./profile-utils";
import { getAdapter } from "./adapters";

/**
 * Heuristic tier of the (eventually layered) autofill engine: matches a
 * page's detected fields against the user's saved profile purely by
 * name/id/label keyword, entirely client-side (no LLM round-trip). A
 * known-site-adapter tier (per-ATS selector maps) and an LLM-fallback tier
 * for whatever this misses are future additions — this is what makes
 * "Autofill" actually do something today.
 *
 * Deliberately does NOT fill: voluntary EEO self-identification fields
 * (gender, ethnicity, veteran/disability status, pronouns) — those are
 * opt-in disclosures the user should answer themselves, not something to
 * guess-fill even if we could pattern-match the field. Also doesn't
 * attempt file inputs (browsers restrict scripted file uploads) or
 * free-text fields with no profile-backed source (salary expectations,
 * notice period, "how did you hear about us").
 */

export function fieldText(field: DetectedField): string {
  return [field.label, field.name, field.id, field.placeholder].filter(Boolean).join(" ").toLowerCase();
}

export function matches(field: DetectedField, ...patterns: RegExp[]): boolean {
  const text = fieldText(field);
  return patterns.some((p) => p.test(text));
}

/** Explicitly excluded from autofill even if a pattern would otherwise match. */
export const NEVER_FILL = /pronoun|veteran|disability|ethnicity|\bgender\b|race/i;

export function mapProfileToFields(
  fields: DetectedField[],
  profile: Profile
): { selector: string; value: string }[] {
  const { first, last } = firstAndLastName(profile.fullName);
  const linkedin = findLink(profile, "linkedin");
  const github = findLink(profile, "github");
  const portfolio = findLink(profile, "portfolio", "website");
  const mostRecentJob = profile.experience[0];
  const mostRecentEducation = profile.education[0];

  const results: { selector: string; value: string }[] = [];

  for (const field of fields) {
    if (field.type === "file") continue; // can't reliably script-set these
    if (matches(field, NEVER_FILL)) continue;

    let value: string | undefined;

    // "Legal Name" is Ashby's actual label for this field on a real,
    // live posting — found by testing, not assumed; "full name" alone
    // missed it entirely. Also handle bare "Name" while excluding first/last/preferred/etc.
    if (
      (matches(field, /full.?name|legal.?name/i) ||
        (matches(field, /\bname\b/i) && !matches(field, /first|last|middle|sur|user|company|school|employer|preferred/i))) &&
      !matches(field, /first|last|middle|sur|preferred/i)
    ) {
      value = profile.fullName;
    } else if (matches(field, /first.?name/i)) {
      value = first;
    } else if (matches(field, /last.?name/i)) {
      value = last;
    } else if (field.type === "email" || matches(field, /email/i)) {
      value = profile.email;
    } else if (field.type === "tel" || matches(field, /phone/i)) {
      value = profile.phone;
    } else if (matches(field, /linkedin/i)) {
      value = linkedin;
    } else if (matches(field, /github/i)) {
      value = github;
    } else if (matches(field, /portfolio|personal.?website|\bwebsite\b/i)) {
      value = portfolio ?? github;
    } else if (matches(field, /location|city|address/i)) {
      value = profile.location;
    } else if (matches(field, /authoriz.*work|work.*authoriz|right.*to.*work|work.*permit/i)) {
      value = yesNo(profile.workAuthorization?.authorizedToWork);
    } else if (matches(field, /sponsorship|require.*visa|visa.*sponsor/i)) {
      value = yesNo(profile.workAuthorization?.requiresSponsorship);
    } else if (matches(field, /cover.?letter/i) && field.type === "textarea") {
      value = profile.summary;
    } else if (matches(field, /\b(employer|company)\b/i) && !matches(field, /website|url/i) && mostRecentJob) {
      value = mostRecentJob.company;
    } else if (matches(field, /job.?title|\btitle\b/i) && !matches(field, /prefix|salutation/i) && mostRecentJob) {
      value = mostRecentJob.title;
    } else if (matches(field, /years.*experience/i) && profile.experience.length) {
      value = String(profile.experience.length);
    } else if (matches(field, /school|university/i) && mostRecentEducation) {
      value = mostRecentEducation.school;
    } else if (matches(field, /degree/i) && mostRecentEducation) {
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
export function runAutofillMapping(
  fields: DetectedField[],
  profile: Profile,
  hostname: string
): { selector: string; value: string }[] {
  const adapter = getAdapter(hostname);
  const adapterResults = adapter?.mapFields(fields, profile) ?? [];

  const claimed = new Set(adapterResults.map((r) => r.selector));
  const remainingFields = fields.filter((f) => !claimed.has(f.selector));
  const heuristicResults = mapProfileToFields(remainingFields, profile);

  return [...adapterResults, ...heuristicResults];
}
