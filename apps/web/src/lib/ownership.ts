import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { resumes } from "@/db/schema";

/** True if `resumeId` exists and belongs to `userId`. */
export async function userOwnsResume(userId: string, resumeId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: resumes.id })
    .from(resumes)
    .where(and(eq(resumes.id, resumeId), eq(resumes.userId, userId)))
    .limit(1);
  return Boolean(row);
}
