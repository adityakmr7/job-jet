import { generateObject } from "ai";
import { z } from "zod";
import type { ResumeContent } from "@job-jet/shared";
import { getModel } from "./ai";

// Mirrors @job-jet/shared's Profile/Resume shape (minus `id` fields — see
// below), but is its own zod schema rather than reusing shared's directly.
// `ai`'s generateObject is typed against zod's own generics; shared's
// schemas are built against a different major version of zod than this
// app resolves (npm gives each package the zod major it declares), and
// mixing the two blows up TS's structural comparison. Small duplication,
// but keeps both sides on a zod version that actually matches what
// consumes it.
const AiExtractionSchema = z.object({
  fullName: z.string(),
  email: z.email(),
  phone: z.string().optional(),
  location: z.string().optional(),
  links: z.array(z.object({ label: z.string(), url: z.url() })).default([]),
  summary: z.string().optional(),
  education: z
    .array(
      z.object({
        school: z.string(),
        degree: z.string().optional(),
        fieldOfStudy: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        gpa: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .default([]),
  experience: z
    .array(
      z.object({
        company: z.string(),
        title: z.string(),
        location: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        current: z.boolean().default(false),
        bullets: z.array(z.string()).default([]),
      })
    )
    .default([]),
  skills: z.array(z.object({ name: z.string(), category: z.string().optional() })).default([]),
});

/**
 * Turns raw extracted resume text into the structured shape the rest of the
 * app works with (Profile-compatible). This is also the schema the
 * tailoring step (JD -> reworded resume) will target later. Education/
 * experience `id`s are assigned locally rather than by the model — asking
 * it to invent one just invites nonsense or collisions.
 */
export async function parseResumeText(rawText: string): Promise<ResumeContent> {
  const { object } = await generateObject({
    model: getModel(),
    schema: AiExtractionSchema,
    system:
      "You extract structured data from resumes. Be faithful to the source " +
      "text — do not invent employers, dates, or achievements that aren't " +
      "present. Normalize dates to YYYY-MM where a specific month is given, " +
      "otherwise YYYY. Leave a field blank/omitted rather than guessing.",
    prompt: `Extract structured resume data from the following text:\n\n${rawText}`,
  });

  return {
    ...object,
    education: object.education.map((e) => ({ ...e, id: crypto.randomUUID() })),
    experience: object.experience.map((e) => ({ ...e, id: crypto.randomUUID() })),
  };
}
