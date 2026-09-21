import type { DetectedField, Profile } from "@job-jet/shared";
import type { SiteAdapter } from "./types";

/**
 * Ashby's standard application form uses a stable `_systemfield_*` id
 * prefix for its core fields — confirmed against a real, live posting
 * (jobs.ashbyhq.com/fieldguide/.../application): `_systemfield_name`,
 * `_systemfield_email`, `_systemfield_resume` (file, never auto-filled).
 * Per-job custom questions (LinkedIn Profile, Portfolio/Personal Website,
 * Phone Number, referral source, "how did you hear about us") get random
 * UUID ids instead — not stable across postings, same shape of limitation
 * as Greenhouse's `question_<id>`. Their labels ARE stable, though, and
 * already covered by the heuristic tier (type=tel for phone, label match
 * for LinkedIn/portfolio) — so this adapter's actual value today is
 * narrow (name + email precision over label-guessing), not because
 * Ashby's custom fields are unreachable, just that id-targeting them
 * isn't possible the way it is for the two system fields.
 */
function byId(fields: DetectedField[], id: string): DetectedField | undefined {
  return fields.find((f) => f.id === id);
}

export const ashbyAdapter: SiteAdapter = {
  name: "Ashby",
  matches: (hostname) => hostname.endsWith("ashbyhq.com"),
  mapFields(fields, profile: Profile) {
    const results: { selector: string; value: string }[] = [];

    const add = (id: string, value: string | undefined) => {
      if (!value) return;
      const field = byId(fields, id);
      if (field) results.push({ selector: field.selector, value });
    };

    add("_systemfield_name", profile.fullName);
    add("_systemfield_email", profile.email);

    return results;
  },
};
