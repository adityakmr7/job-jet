import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "./ai";
import { ALLOWED_PROFILE_FIELD_PATHS, PROFILE_FIELD_PATH_DESCRIPTIONS } from "./field-paths";

/** What the LLM prompt sees for each field (an index instead of a
 *  selector, no id) — intentionally narrower than @job-jet/shared's
 *  DetectedField. */
export type FieldForPrompt = {
  index: number;
  label?: string;
  name?: string;
  placeholder?: string;
  type: string;
  options?: string[];
};

const MatchResultSchema = z.object({
  matches: z.array(
    z.object({
      index: z.number(),
      // z.enum requires a non-empty tuple; ALLOWED_PROFILE_FIELD_PATHS is a
      // hand-written non-empty const array, so the cast is just satisfying
      // TS's inability to narrow a readonly string[] to a tuple type.
      profileFieldPath: z.enum(ALLOWED_PROFILE_FIELD_PATHS as unknown as [string, ...string[]]).nullable(),
    })
  ),
});

/**
 * Tier 3 of the autofill engine: for fields the heuristic + adapter tiers
 * didn't recognize, ask the model which (if any) of a fixed, closed set of
 * known profile attributes each field is asking for — see field-paths.ts
 * for why the model only ever returns a KEY, never a value. Returns one
 * result per input field, in the same order, `profileFieldPath: null`
 * where the model found no confident match (an essay question, salary
 * expectations, "how did you hear about us" — anything this tier isn't
 * meant to answer).
 */
export async function matchFieldsToProfilePaths(
  fields: FieldForPrompt[]
): Promise<{ index: number; profileFieldPath: string | null }[]> {
  if (fields.length === 0) return [];

  const allowList = ALLOWED_PROFILE_FIELD_PATHS.map(
    (key) => `- "${key}": ${PROFILE_FIELD_PATH_DESCRIPTIONS[key]}`
  ).join("\n");

  const { object } = await generateObject({
    model: getModel(),
    schema: MatchResultSchema,
    system:
      "You match job application form fields to a fixed set of known candidate-profile attributes. " +
      "For EACH field given (by its index, using its label/name/placeholder/type/options), decide which " +
      "SINGLE attribute from this exact list it is asking for, or null if none confidently apply " +
      "(this includes open-ended/essay questions, salary expectations, referral source, EEO/demographic " +
      "questions, and anything ambiguous — when unsure, return null rather than guess):\n\n" +
      allowList +
      "\n\nReturn exactly one result per input field, in the same order, using its index. " +
      "Only use keys from the list above, exactly as spelled — never invent a new key.",
    prompt: `Fields:\n${JSON.stringify(fields, null, 2)}`,
  });

  // Guard against the model skipping an index or returning a key outside
  // the allow-list (zod's enum already rejects that at parse time, but
  // stay defensive about count/order too) — callers get exactly one
  // result per input field.
  const byIndex = new Map(object.matches.map((m) => [m.index, m.profileFieldPath]));
  return fields.map((f) => ({ index: f.index, profileFieldPath: byIndex.get(f.index) ?? null }));
}
