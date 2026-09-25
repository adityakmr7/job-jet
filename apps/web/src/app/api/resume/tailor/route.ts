import { NextResponse, after } from "next/server";
import { eq } from "drizzle-orm";
import { put, del } from "@vercel/blob";
import type { ResumeContent } from "@job-jet/shared";
import { getDb } from "@/db";
import { profiles, resumes } from "@/db/schema";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { corsHeaders } from "@/lib/cors";
import { tailorResume } from "@/lib/resume-tailor";
import { renderResumePdf } from "@/lib/resume-pdf";
import { readJsonBody, withErrorHandling } from "@/lib/http";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { TailorRequestSchema, validationErrorBody } from "@/lib/validation";

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

/**
 * Tailors the user's saved profile (not a re-parsed upload — the profile
 * is the canonical, user-reviewed source) to a job description, renders
 * the result as a PDF, and stores it as a new `resumes` row (kind:
 * "ai_tailored"). Source of the JD is expected to be the extension, which
 * extracts it from whatever job page the user is on.
 */
export const POST = withErrorHandling("api/resume/tailor POST", async (req: Request) => {
  const headers = corsHeaders(req.headers.get("origin"));
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });

  const parsed = TailorRequestSchema.safeParse(await readJsonBody(req));
  if (!parsed.success) {
    return NextResponse.json(validationErrorBody(parsed.error), { status: 400, headers });
  }
  const { jobDescription, jobTitle, company } = parsed.data;

  const db = getDb();
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1);
  if (!profile) {
    return NextResponse.json(
      { error: "No saved profile yet — fill out your profile before generating a tailored resume." },
      { status: 400, headers }
    );
  }

  const sourceContent: ResumeContent = {
    fullName: profile.fullName,
    email: profile.email,
    phone: profile.phone ?? undefined,
    location: profile.location ?? undefined,
    links: profile.links ?? [],
    summary: profile.summary ?? undefined,
    education: profile.education ?? [],
    experience: profile.experience ?? [],
    skills: profile.skills ?? [],
  };

  const limited = await enforceRateLimit(RATE_LIMITS.resumeTailor, user.id, headers);
  if (limited) return limited;

  let tailored: ResumeContent;
  try {
    tailored = await tailorResume(sourceContent, jobDescription);
  } catch (err) {
    console.error("[api/resume/tailor] AI tailoring failed:", err);
    return NextResponse.json({ error: "AI tailoring failed — please try again." }, { status: 502, headers });
  }

  const pdfStream = await renderResumePdf(tailored);
  const fileName = `${profile.fullName} - ${company || jobTitle || "Tailored Resume"}.pdf`.replace(/[/\\]/g, "-");
  const blob = await put(`resumes/${user.id}/tailored-${Date.now()}.pdf`, pdfStream, {
    access: "private",
    contentType: "application/pdf",
  });

  let saved;
  try {
    [saved] = await db
      .insert(resumes)
      .values({
        userId: user.id,
        kind: "ai_tailored",
        fileName,
        blobUrl: blob.url,
        content: tailored,
        tailoredFor: { jobTitle, company, jobDescription },
      })
      .returning();
  } catch (err) {
    after(() => del(blob.url).catch((e) => console.error("[api/resume/tailor] failed to delete orphaned blob:", e)));
    throw err;
  }

  return NextResponse.json({ resume: saved }, { headers });
});
