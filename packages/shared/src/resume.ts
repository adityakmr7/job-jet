import { z } from "zod";
import { ProfileSchema } from "./profile";

// The structured content backing a resume version (subset of Profile shape,
// but resume-specific: tailored bullets/ordering may differ from the user's
// canonical profile). Also what resume-parsing AI calls are asked to
// produce, so it's exported standalone rather than inlined into ResumeSchema.
export const ResumeContentSchema = ProfileSchema.pick({
  fullName: true,
  email: true,
  phone: true,
  location: true,
  links: true,
  summary: true,
  education: true,
  experience: true,
  skills: true,
});

export type ResumeContent = z.infer<typeof ResumeContentSchema>;

export const ResumeSchema = z.object({
  id: z.string(),
  userId: z.string(),
  kind: z.enum(["uploaded_original", "ai_tailored"]),
  fileName: z.string(),
  blobUrl: z.string().url(),
  content: ResumeContentSchema,
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
