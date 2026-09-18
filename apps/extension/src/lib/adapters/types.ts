import type { DetectedField, Profile } from "@job-jet/shared";

/**
 * Known-site adapter: tier 2 of the autofill engine. Where the heuristic
 * tier (tier 1) matches fields by guessing at label/name text, an adapter
 * targets a specific ATS's *documented, stable* field identifiers directly
 * — the id/name attributes a platform uses for every company hosted on it,
 * confirmed by inspecting real, current job application pages rather than
 * assumed from memory (see git history / docs/ARCHITECTURE.md for which
 * pages).
 *
 * Deliberately scoped to each platform's standard/core fields only (name,
 * email, phone, location, standard links). Per-job custom questions
 * (Greenhouse's "question_<id>", Lever's "cards[<uuid>][fieldN]") are
 * neither stable across postings nor answerable from a static profile —
 * those stay the heuristic tier's job where it can, and are the reason a
 * future LLM-fallback tier exists on the roadmap.
 */
export interface SiteAdapter {
  name: string;
  matches(hostname: string): boolean;
  /** Given the page's already-detected fields, returns confident
   *  {selector, value} mappings for this site's core fields — identified
   *  by inspecting each field's real id/name, not by guessing from label
   *  text the way the heuristic tier does. Fields this doesn't recognize
   *  are left for the heuristic tier to attempt. */
  mapFields(fields: DetectedField[], profile: Profile): { selector: string; value: string }[];
}
