import type { resumes } from "@/db/schema";

type ResumeRow = typeof resumes.$inferSelect;

/**
 * What API responses expose about a resume. The Blob URL is an internal
 * storage locator (the store is private, so it isn't directly fetchable,
 * but there's no reason to hand it to clients either) — files are only
 * ever served through the ownership-checked /api/resume/[id]/download route.
 */
export function toResumeDto(row: ResumeRow) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { blobUrl, ...rest } = row;
  return rest;
}
