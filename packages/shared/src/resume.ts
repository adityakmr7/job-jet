import { z } from "zod";
import { ProfileSchema } from "./profile";

export const ResumeSchema = z.object({
  id: z.string(),
  userId: z.string(),
  kind: z.enum(["uploaded_original", "ai_tailored"]),
  fileName: z.string(),
  blobUrl: z.string().url(),
  // The structured content backing this resume version (subset of Profile
  // shape, but resume-specific: tailored bullets/ordering may differ from
  // the user's canonical profile).
  content: ProfileSchema.pick({
    fullName: true,
    email: true,
    phone: true,
    location: true,
    links: true,
    summary: true,
    education: true,
    experience: true,
    skills: true,
  }),
  // Only set for kind === "ai_tailored"
  tailoredFor: z
    .object({
      jobTitle: z.string().optional(),
      company: z.string().optional(),
      jobDescription: z.string(),
      applicationId: z.string().optional(),
    })
    .optional(),
  createdAt: z.string(),
});

export type Resume = z.infer<typeof ResumeSchema>;
