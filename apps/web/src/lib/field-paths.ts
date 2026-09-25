import type { Profile } from "@job-jet/shared";

/**
 * The LLM fallback tier (tier 3 of the autofill engine) is "safe by
 * construction" the same way resume-tailor.ts is: the model is never asked
 * to produce a value that gets typed into a real job application. It only
 * ever picks a KEY from this closed, hand-written list — the actual value
 * is looked up from the user's real profile in code, right here. A
 * hallucinated or malformed key just fails to resolve (falls through to
 * `undefined`, field stays unfilled) instead of ever reaching the page.
 *
 * Deliberately scoped to the same "answerable from a static profile"
 * fields the heuristic tier already targets (see autofill-map.ts) — this
 * tier exists to catch fields tier 1/2 missed on *wording*, not to expand
 * into open-ended questions (cover letters, "why this company", salary
 * expectations) a model would have to invent an answer for.
 */
export const ALLOWED_PROFILE_FIELD_PATHS = [
  "fullName",
  "firstName",
  "lastName",
  "email",
  "phone",
  "location",
  "linkedin",
  "github",
  "portfolio",
  "currentCompany",
  "currentTitle",
  "yearsOfExperience",
  "school",
  "degree",
  "authorizedToWork",
  "requiresSponsorship",
] as const;

export type ProfileFieldPath = (typeof ALLOWED_PROFILE_FIELD_PATHS)[number];

function findLink(profile: Profile, ...keywords: string[]): string | undefined {
  // Keywords are in priority order: findLink(p, "portfolio", "github")
  // must return the portfolio link even if a GitHub link is listed first.
  for (const kw of keywords) {
    const link = profile.links.find((l) => l.label.toLowerCase().includes(kw) || l.url.toLowerCase().includes(kw));
    if (link) return link.url;
  }
  return undefined;
}

function yesNo(value: boolean | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value ? "Yes" : "No";
}

/** Resolves an (untrusted, model-chosen) path string against the user's
 *  REAL profile. Returns undefined for anything not in the allow-list
 *  above or not present in this particular profile — never throws, so a
 *  bad/hallucinated key just means "don't fill this field". */
export function resolveProfileFieldPath(profile: Profile, path: string): string | undefined {
  const mostRecentJob = profile.experience[0];
  const mostRecentEducation = profile.education[0];
  const [first, ...rest] = profile.fullName.trim().split(/\s+/);

  switch (path as ProfileFieldPath) {
    case "fullName":
      return profile.fullName || undefined;
    case "firstName":
      return first || undefined;
    case "lastName":
      return rest.join(" ") || undefined;
    case "email":
      return profile.email || undefined;
    case "phone":
      return profile.phone || undefined;
    case "location":
      return profile.location || undefined;
    case "linkedin":
      return findLink(profile, "linkedin");
    case "github":
      return findLink(profile, "github");
    case "portfolio":
      return findLink(profile, "portfolio", "website", "github");
    case "currentCompany":
      return mostRecentJob?.company;
    case "currentTitle":
      return mostRecentJob?.title;
    case "yearsOfExperience":
      return profile.experience.length ? String(profile.experience.length) : undefined;
    case "school":
      return mostRecentEducation?.school;
    case "degree":
      return mostRecentEducation?.degree;
    case "authorizedToWork":
      return yesNo(profile.workAuthorization?.authorizedToWork);
    case "requiresSponsorship":
      return yesNo(profile.workAuthorization?.requiresSponsorship);
    default:
      return undefined;
  }
}

/** Short human descriptions given to the model alongside the allow-list —
 *  keeps the prompt self-documenting instead of relying on the key names
 *  alone to convey meaning. */
export const PROFILE_FIELD_PATH_DESCRIPTIONS: Record<ProfileFieldPath, string> = {
  fullName: "the candidate's full legal name",
  firstName: "the candidate's first/given name only",
  lastName: "the candidate's last/family name only",
  email: "the candidate's email address",
  phone: "the candidate's phone number",
  location: "the candidate's city/location",
  linkedin: "a LinkedIn profile URL",
  github: "a GitHub profile URL",
  portfolio: "a personal website / portfolio URL (not LinkedIn or GitHub)",
  currentCompany: "the candidate's current or most recent employer's name",
  currentTitle: "the candidate's current or most recent job title",
  yearsOfExperience: "total years of professional experience, as a number",
  school: "the candidate's most recent school/university name",
  degree: "the candidate's most recent degree (e.g. \"B.S. Computer Science\")",
  authorizedToWork: "yes/no: is the candidate legally authorized to work in this country",
  requiresSponsorship: "yes/no: will the candidate require visa sponsorship",
};
