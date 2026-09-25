import { z } from "zod";
import { applicationStatusEnum } from "@/db/schema";
import { ALLOWED_PROFILE_FIELD_PATHS, type ProfileFieldPath } from "./field-paths";

/**
 * Request validation + size limits for API routes. Limits are generous for
 * real use but bound how much text can be pushed into a Gemini prompt or a
 * DB row per request.
 */

export const LIMITS = {
  jobDescription: 30_000, // extension extracts at most 20k chars
  shortText: 300, // titles, company names
  notes: 10_000,
  autofillFields: 150,
  fieldSelector: 200,
  fieldLabel: 500,
  fieldAttr: 300,
  fieldType: 40,
  fieldOptions: 200,
  fieldOption: 300,
  url: 2_048,
  resumeTextChars: 60_000,
} as const;

export const UuidSchema = z.uuid();

const optionalShortText = z.string().trim().max(LIMITS.shortText).optional();
const nullableShortText = z.string().trim().max(LIMITS.shortText).nullable().optional();

export const ApplicationStatusSchema = z.enum(applicationStatusEnum.enumValues);

export const TailorRequestSchema = z.object({
  jobDescription: z
    .string()
    .trim()
    .min(1, "Missing jobDescription")
    .max(LIMITS.jobDescription, `jobDescription is too long (max ${LIMITS.jobDescription} characters)`),
  jobTitle: optionalShortText,
  company: optionalShortText,
});

export const IncomingFieldSchema = z.object({
  selector: z.string().min(1).max(LIMITS.fieldSelector),
  label: z.string().max(LIMITS.fieldLabel).optional(),
  name: z.string().max(LIMITS.fieldAttr).optional(),
  id: z.string().max(LIMITS.fieldAttr).optional(),
  placeholder: z.string().max(LIMITS.fieldAttr).optional(),
  type: z.string().min(1).max(LIMITS.fieldType),
  options: z.array(z.string().max(LIMITS.fieldOption)).max(LIMITS.fieldOptions).optional(),
});

export type IncomingField = z.infer<typeof IncomingFieldSchema>;

export const AutofillMapRequestSchema = z.object({
  domain: z.string().min(1).max(LIMITS.url),
  fields: z.array(IncomingFieldSchema).max(LIMITS.autofillFields),
});

/** POST /api/applications (extension upsert). */
export const ApplicationUpsertSchema = z.object({
  url: z.string().trim().min(1, "Missing url").max(LIMITS.url),
  company: optionalShortText,
  jobTitle: optionalShortText,
  jobDescription: z.string().max(LIMITS.jobDescription).optional(),
  resumeId: UuidSchema.optional(),
  status: ApplicationStatusSchema.optional(),
});

/** PATCH /api/applications/[id] (dashboard edits). null clears a field. */
export const ApplicationPatchSchema = z.object({
  company: nullableShortText,
  jobTitle: nullableShortText,
  jobDescription: z.string().max(LIMITS.jobDescription).nullable().optional(),
  notes: z.string().max(LIMITS.notes).nullable().optional(),
  resumeId: UuidSchema.nullable().optional(),
  status: ApplicationStatusSchema.optional(),
});

/**
 * Normalizes the site key used for the crowdsourced field-mapping cache.
 * Accepts a bare hostname or a full URL, returns a lowercase hostname, or
 * null if it isn't a plausible public hostname — so one client can't
 * create arbitrary cache keys (paths, junk strings, huge values).
 */
export function normalizeSiteKey(input: string): string | null {
  const raw = input.trim();
  if (!raw || raw.length > LIMITS.url) return null;
  let hostname: string;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }
  if (hostname.length > 253) return null;
  // Letters/digits/hyphens in dot-separated labels, at least one dot
  // (rejects "localhost", IPv6 literals, and anything URL parsing let through).
  if (!/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/.test(hostname)) return null;
  return hostname;
}

const ALLOWED_PATHS = new Set<string>(ALLOWED_PROFILE_FIELD_PATHS);

// Field types a profile value is never typed into.
const NEVER_FILL_TYPES = new Set([
  "file",
  "checkbox",
  "radio",
  "password",
  "hidden",
  "submit",
  "button",
  "reset",
  "image",
  "date",
  "datetime-local",
  "month",
  "week",
  "time",
  "color",
  "range",
]);

const TYPE_REQUIRES_PATH: Record<string, ProfileFieldPath[]> = {
  email: ["email"],
  tel: ["phone"],
  url: ["linkedin", "github", "portfolio"],
  number: ["yearsOfExperience"],
};

/**
 * Guards a mapping decision (cached or fresh from the model) before it's
 * applied to a submitted field: the path must be in the allow-list and be
 * compatible with the field's input type. The mapping cache is shared
 * across all users, so this stops a bad/poisoned entry from, e.g., putting
 * an email address into a phone input or anything into a file input.
 */
export function isMappingCompatible(path: string, field: Pick<IncomingField, "type">): path is ProfileFieldPath {
  if (!ALLOWED_PATHS.has(path)) return false;
  const type = field.type.toLowerCase();
  if (NEVER_FILL_TYPES.has(type)) return false;
  const required = TYPE_REQUIRES_PATH[type];
  if (required && !required.includes(path as ProfileFieldPath)) return false;
  return true;
}

/** Shape a zod error into a compact 400 payload. */
export function validationErrorBody(error: z.ZodError, message = "Invalid request") {
  return {
    error: error.issues[0]?.message && error.issues.length === 1 ? error.issues[0].message : message,
    issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  };
}
