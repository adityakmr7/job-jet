import type { DetectedField, Profile } from "@job-jet/shared";
import type { SiteAdapter } from "./types";
import { findLink } from "../profile-utils";

/**
 * Lever's standard application form uses stable `name` attributes for its
 * core fields — confirmed against a real, live posting
 * (jobs.lever.co/palantir/.../apply): name, email, phone, location, org
 * (current company), urls[LinkedIn], urls[GitHub], urls[Portfolio],
 * resume (file, never auto-filled). Unlike Greenhouse, Lever asks for full
 * name as one field rather than first/last separately. Per-job custom
 * questions live under "cards[<uuid>][fieldN]" — not stable across
 * postings, left to the heuristic tier.
 */
function byName(fields: DetectedField[], name: string): DetectedField | undefined {
  return fields.find((f) => f.name === name);
}

export const leverAdapter: SiteAdapter = {
  name: "Lever",
  matches: (hostname) => hostname === "jobs.lever.co",
  mapFields(fields, profile: Profile) {
    const linkedin = findLink(profile, "linkedin");
    const github = findLink(profile, "github");
    const portfolio = findLink(profile, "portfolio", "website");
    const mostRecentJob = profile.experience[0];
    const results: { selector: string; value: string }[] = [];

    const add = (name: string, value: string | undefined) => {
      if (!value) return;
      const field = byName(fields, name);
      if (field) results.push({ selector: field.selector, value });
    };

    add("name", profile.fullName);
    add("email", profile.email);
    add("phone", profile.phone);
    add("location", profile.location);
    add("org", mostRecentJob?.company);
    add("urls[LinkedIn]", linkedin);
    add("urls[GitHub]", github);
    add("urls[Portfolio]", portfolio);

    return results;
  },
};
