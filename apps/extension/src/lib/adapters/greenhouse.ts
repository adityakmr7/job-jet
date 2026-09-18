import type { DetectedField, Profile } from "@job-jet/shared";
import type { SiteAdapter } from "./types";
import { firstAndLastName } from "../profile-utils";

/**
 * Greenhouse's standard embedded application form uses stable, predictable
 * element `id`s for its core fields — confirmed by inspecting a real, live
 * posting (job-boards.greenhouse.io/figma/jobs/6142506004) rather than
 * assumed: first_name, last_name, email, phone, candidate-location,
 * resume (file, never auto-filled). Per-job custom questions use ids like
 * "question_19432571004" — not stable across postings, left to the
 * heuristic tier's label-text matching.
 */
function byId(fields: DetectedField[], id: string): DetectedField | undefined {
  return fields.find((f) => f.id === id);
}

export const greenhouseAdapter: SiteAdapter = {
  name: "Greenhouse",
  matches: (hostname) => hostname.endsWith("greenhouse.io"),
  mapFields(fields, profile: Profile) {
    const { first, last } = firstAndLastName(profile.fullName);
    const results: { selector: string; value: string }[] = [];

    const add = (id: string, value: string | undefined) => {
      if (!value) return;
      const field = byId(fields, id);
      if (field) results.push({ selector: field.selector, value });
    };

    add("first_name", first);
    add("last_name", last);
    add("email", profile.email);
    add("phone", profile.phone);
    add("candidate-location", profile.location);

    // Some custom "question_*" fields have stable, common labels across
    // most Greenhouse postings even though their ids aren't stable — the
    // heuristic tier already catches these by label text (LinkedIn
    // Profile, Other Website, etc.), so this adapter intentionally
    // doesn't duplicate that here.

    return results;
  },
};
