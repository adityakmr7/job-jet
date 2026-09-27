import { z } from "zod";
import { ANSWER_LIMITS, SALARY_PERIODS, WORK_MODES, sanitizeAnswerText } from "./answer-helpers";

/**
 * Saved answers: the recurring application questions that aren't on a
 * resume ("How did you hear about us?", notice period, salary expectation,
 * country-specific work authorization, ...). Answered once on the Profile
 * page, reused by every autofill tier. Helpers (country detection, notice
 * period, salary, custom-answer matching) are in answer-helpers.ts.
 *
 * Every field is optional and nothing here is ever inferred. Voluntary
 * demographic answers are only used when the user explicitly set them;
 * otherwise those questions stay on the never-fill list.
 */

function cleanText(max: number) {
  return z.string().max(max).transform(sanitizeAnswerText);
}

export const CountryWorkAuthSchema = z.object({
  country: cleanText(60).pipe(z.string().min(1, "Country can't be empty")),
  authorizedToWork: z.boolean().optional(),
  requiresSponsorship: z.boolean().optional(),
});

export const CustomAnswerSchema = z.object({
  id: z.string().min(1).max(64),
  question: cleanText(ANSWER_LIMITS.customQuestion).pipe(z.string().min(1, "Custom question can't be empty")),
  answer: cleanText(ANSWER_LIMITS.customAnswer).pipe(z.string().min(1, "Custom answer can't be empty")),
});

const demographicAnswer = cleanText(100).optional();

export const DemographicAnswersSchema = z.object({
  gender: demographicAnswer,
  raceEthnicity: demographicAnswer,
  hispanicLatino: demographicAnswer,
  veteranStatus: demographicAnswer,
  disabilityStatus: demographicAnswer,
  lgbtq: demographicAnswer,
  transgender: demographicAnswer,
  sexualOrientation: demographicAnswer,
});

export const ApplicationAnswersSchema = z.object({
  /** "How did you hear about us?" default answer. */
  referralSource: cleanText(ANSWER_LIMITS.shortAnswer).optional(),
  /** Free text such as "Immediately", "2 weeks", "1 month", "3 months". */
  noticePeriod: cleanText(ANSWER_LIMITS.shortAnswer).optional(),
  /** ISO date (YYYY-MM-DD); empty string clears it. */
  earliestStartDate: z
    .union([
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD"),
      z.literal("").transform(() => undefined),
    ])
    .optional(),
  salary: z
    .object({
      amount: z.number().positive().max(100_000_000),
      currency: z
        .string()
        .transform((c) => c.trim().toUpperCase())
        .pipe(z.string().regex(/^[A-Z]{3}$/, "Currency must be a 3-letter code like USD")),
      period: z.enum(SALARY_PERIODS),
    })
    .optional(),
  willingToRelocate: z.boolean().optional(),
  workModes: z.array(z.enum(WORK_MODES)).max(WORK_MODES.length).optional(),
  yearsOfExperience: z.number().min(0).max(70).optional(),
  /** Per-country answers. The profile's top-level workAuthorization stays
   *  the default for questions that don't name a country. */
  workAuthorizationByCountry: z.array(CountryWorkAuthSchema).max(ANSWER_LIMITS.countries).optional(),
  pronouns: cleanText(40).optional(),
  demographics: DemographicAnswersSchema.optional(),
  customAnswers: z.array(CustomAnswerSchema).max(ANSWER_LIMITS.customAnswers).optional(),
});

export type ApplicationAnswers = z.infer<typeof ApplicationAnswersSchema>;
export type ApplicationAnswersInput = z.input<typeof ApplicationAnswersSchema>;
export type CountryWorkAuth = z.infer<typeof CountryWorkAuthSchema>;
export type CustomAnswer = z.infer<typeof CustomAnswerSchema>;
export type DemographicAnswers = z.infer<typeof DemographicAnswersSchema>;
