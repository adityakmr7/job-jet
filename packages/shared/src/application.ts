import { z } from "zod";

export const ApplicationStatusSchema = z.enum([
  "detected", // extension saw a job form but user hasn't acted yet
  "draft", // user opened the side panel / started filling
  "applied",
  "interviewing",
  "rejected",
  "offer",
]);

export const ApplicationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  url: z.string().url(),
  domain: z.string(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  jobDescription: z.string().optional(),
  notes: z.string().optional(),
  resumeId: z.string().optional(),
  status: ApplicationStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;
export type Application = z.infer<typeof ApplicationSchema>;
