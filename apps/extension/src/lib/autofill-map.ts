import type { DetectedField, Profile } from "@job-jet/shared";

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

function fieldText(field: DetectedField): string {
  return [field.label, field.name, field.id, field.placeholder].filter(Boolean).join(" ").toLowerCase();
}

function matches(field: DetectedField, ...patterns: RegExp[]): boolean {
  const text = fieldText(field);
  return patterns.some((p) => p.test(text));
}

function firstAndLastName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

function findLink(profile: Profile, ...keywords: string[]): string | undefined {
  const link = profile.links.find((l) =>
    keywords.some((kw) => l.label.toLowerCase().includes(kw) || l.url.toLowerCase().includes(kw))
  );
  return link?.url;
}

function yesNo(value: boolean | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value ? "Yes" : "No";
}

/** Explicitly excluded from autofill even if a pattern would otherwise match. */
const NEVER_FILL = /pronoun|veteran|disability|ethnicity|\bgender\b|race/i;

export function mapProfileToFields(
  fields: DetectedField[],
  profile: Profile
): { selector: string; value: string }[] {
  const { first, last } = firstAndLastName(profile.fullName);
  const linkedin = findLink(profile, "linkedin");
  const portfolio = findLink(profile, "portfolio", "website", "github");
  const mostRecentJob = profile.experience[0];
  const mostRecentEducation = profile.education[0];

  const results: { selector: string; value: string }[] = [];

  for (const field of fields) {
    if (field.type === "file") continue; // can't reliably script-set these
    if (matches(field, NEVER_FILL)) continue;

    let value: string | undefined;

    if (matches(field, /full.?name/i) && !matches(field, /first|last/i)) {
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
    } else if (matches(field, /portfolio|personal.?website|github/i)) {
      value = portfolio;
    } else if (matches(field, /location|city|address/i)) {
      value = profile.location;
    } else if (matches(field, /work.?authoriz/i)) {
      value = yesNo(profile.workAuthorization?.authorizedToWork);
    } else if (matches(field, /sponsorship/i)) {
      value = yesNo(profile.workAuthorization?.requiresSponsorship);
    } else if (matches(field, /cover.?letter/i) && field.type === "textarea") {
      value = profile.summary;
    } else if (matches(field, /current.*employer|company/i) && mostRecentJob) {
      value = mostRecentJob.company;
    } else if (matches(field, /current.*title|job.?title/i) && mostRecentJob) {
      value = mostRecentJob.title;
    } else if (matches(field, /years.*experience/i) && profile.experience.length) {
      value = String(profile.experience.length);
    } else if (matches(field, /school|university/i) && mostRecentEducation) {
      value = mostRecentEducation.school;
    } else if (matches(field, /degree/i) && mostRecentEducation) {
      value = mostRecentEducation.degree;
    }

    if (value) results.push({ selector: field.selector, value });
  }

  return results;
}
