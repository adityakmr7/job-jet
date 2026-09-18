import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { put } from "@vercel/blob";
import type { ResumeContent } from "@job-jet/shared";
import { getDb } from "@/db";
import { profiles, resumes } from "@/db/schema";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { corsHeaders } from "@/lib/cors";
import { tailorResume } from "@/lib/resume-tailor";
import { renderResumePdf } from "@/lib/resume-pdf";

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
export async function POST(req: Request) {
  const headers = corsHeaders(req.headers.get("origin"));
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });

  const body = await req.json().catch(() => null);
  const jobDescription = typeof body?.jobDescription === "string" ? body.jobDescription.trim() : "";
  if (!jobDescription) {
    return NextResponse.json({ error: "Missing jobDescription" }, { status: 400, headers });
  }
  const jobTitle = typeof body?.jobTitle === "string" ? body.jobTitle : undefined;
  const company = typeof body?.company === "string" ? body.company : undefined;

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

  let tailored: ResumeContent;
  try {
    tailored = await tailorResume(sourceContent, jobDescription);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI tailoring failed" },
      { status: 502, headers }
    );
  }

  const pdfStream = await renderResumePdf(tailored);
  const fileName = `${profile.fullName} - ${company || jobTitle || "Tailored Resume"}.pdf`.replace(/[/\\]/g, "-");
  const blob = await put(`resumes/${user.id}/tailored-${Date.now()}.pdf`, pdfStream, {
    access: "private",
    contentType: "application/pdf",
  });

  const [saved] = await db
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

  return NextResponse.json({ resume: saved }, { headers });
}
