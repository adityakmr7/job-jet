import { z } from "zod";

/**
 * The canonical, structured representation of a user's professional
 * background. This is what a resume gets parsed INTO on upload, what the
 * autofill engine maps form fields AGAINST, and what the AI tailoring step
 * takes as input alongside a job description.
 */

export const LinkSchema = z.object({
  label: z.string(), // "LinkedIn", "GitHub", "Portfolio", etc.
  url: z.string().url(),
});

export const EducationSchema = z.object({
  id: z.string(),
  school: z.string(),
  degree: z.string().optional(),
  fieldOfStudy: z.string().optional(),
  startDate: z.string().optional(), // ISO "YYYY-MM"
  endDate: z.string().optional(),
  gpa: z.string().optional(),
  description: z.string().optional(),
});

export const WorkExperienceSchema = z.object({
  id: z.string(),
  company: z.string(),
  title: z.string(),
  location: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(), // undefined/omitted = "present"
  current: z.boolean().default(false),
  bullets: z.array(z.string()).default([]),
});

export const SkillSchema = z.object({
  name: z.string(),
  category: z.string().optional(), // "Languages", "Frameworks", etc.
});

export const ProfileSchema = z.object({
  id: z.string(),
  userId: z.string(),
  fullName: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
  location: z.string().optional(),
  links: z.array(LinkSchema).default([]),
  summary: z.string().optional(),
  education: z.array(EducationSchema).default([]),
  experience: z.array(WorkExperienceSchema).default([]),
  skills: z.array(SkillSchema).default([]),
  // Common job-application questions that aren't part of a resume but are
  // asked on nearly every ATS form, so we capture them once and reuse them.
  workAuthorization: z
    .object({
      authorizedToWork: z.boolean().optional(),
      requiresSponsorship: z.boolean().optional(),
    })
    .optional(),
  additionalQuestions: z
    .record(z.string(), z.string())
    .optional()
    .describe("Free-form Q&A pairs the user has answered before, keyed by a normalized question string, reused as suggestions for similar questions on new forms."),
  updatedAt: z.string().optional(),
});

export type Link = z.infer<typeof LinkSchema>;
export type Education = z.infer<typeof EducationSchema>;
export type WorkExperience = z.infer<typeof WorkExperienceSchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
