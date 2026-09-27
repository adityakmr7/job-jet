import { z } from "zod";

/**
 * A single form field on a detected job-application page, as the content
 * script sees it, before it's been matched to a profile field.
 */
export const DetectedFieldSchema = z.object({
  selector: z.string(), // stable-ish CSS selector or generated data-attr hook
  label: z.string().optional(), // associated <label>, aria-label, or nearby text
  name: z.string().optional(),
  id: z.string().optional(),
  placeholder: z.string().optional(),
  type: z.string(), // input type / "select" / "textarea" / "file" / "yesno" (button-group Yes/No question)
  options: z.array(z.string()).optional(), // for select/radio/checkbox groups
  // For a radio/checkbox (or a Yes/No button group), the group's question
  // ("Will you require visa sponsorship?") — `label` is then the option's
  // own text ("Yes"). Without it every option of every group reads "Yes"/"No".
  question: z.string().optional(),
  // Which frame of the tab the field lives in (0 = top document). Set by
  // the side panel when it merges fields from an embedded ATS iframe.
  frameId: z.number().int().optional(),
});

/** Keys from Profile (dot-path) or a literal freeform question. */
export const ProfileFieldPathSchema = z.string();

/**
 * Crowdsourced mapping: for a given domain + field signature, what profile
 * field (or freeform question) it corresponds to. Stored server-side and
 * synced to the extension so repeat visits to the same ATS get faster/more
 * accurate over time, without re-asking the LLM every time.
 */
export const FieldMappingSchema = z.object({
  id: z.string(),
  domain: z.string(),
  fieldSignature: z.string().describe("normalized hash of name/id/label used as a lookup key"),
  profileFieldPath: ProfileFieldPathSchema,
  confidence: z.number().min(0).max(1),
  source: z.enum(["heuristic", "llm", "user_correction"]),
  hitCount: z.number().default(0),
  updatedAt: z.string(),
});

export type DetectedField = z.infer<typeof DetectedFieldSchema>;
export type FieldMapping = z.infer<typeof FieldMappingSchema>;

/**
 * Normalizes a field's label/placeholder/name/id + type into a stable
 * lookup key for the `field_mappings` cache. Deliberately prefers label
 * text over `name`/`id` — Greenhouse's custom "question_*" fields (and
 * plenty of other ATSs) keep a consistent human-readable label ("LinkedIn
 * Profile", "Are you authorized to work in the US?") across postings even
 * though their id/name attributes are per-posting-random — matching on
 * label is what makes the cache actually hit on the second posting, not
 * just the second visit to the exact same one.
 *
 * Plain function, not a zod schema — safe to import from either app.
 * (All workspaces use zod 4; apps/web's resume-parse.ts and
 * resume-tailor.ts still keep their own AI-facing schemas because those
 * intentionally differ from the canonical shapes above.)
 */
export function computeFieldSignature(
  field: Pick<DetectedField, "label" | "name" | "id" | "placeholder" | "type">
): string {
  const raw = field.label || field.placeholder || field.name || field.id || "";
  const normalized = raw
    .toLowerCase()
    .replace(/[*]/g, "") // strip required-field asterisks
    .replace(/[^a-z0-9\s]/g, " ") // strip punctuation
    .replace(/\s+/g, " ")
    .trim();
  return `${normalized}::${field.type}`;
}
