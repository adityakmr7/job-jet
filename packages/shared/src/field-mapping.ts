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
  type: z.string(), // input type / "select" / "textarea" / "file"
  options: z.array(z.string()).optional(), // for select/radio/checkbox groups
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
