import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/db";
import { resumes } from "@/db/schema";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { extractResumeText } from "@/lib/extract-text";
import { parseResumeText } from "@/lib/resume-parse";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function GET() {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const rows = await db
    .select()
    .from(resumes)
    .where(eq(resumes.userId, user.id))
    .orderBy(desc(resumes.createdAt));

  return NextResponse.json({ resumes: rows });
}

/** Uploads a resume file, extracts its text, stores the original in Blob,
 *  and has the model structure it into the canonical Profile-compatible shape. */
export async function POST(req: Request) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  let rawText: string;
  try {
    rawText = await extractResumeText(file);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't read that file" },
      { status: 400 }
    );
  }
  if (!rawText.trim()) {
    return NextResponse.json({ error: "Couldn't extract any text from that file" }, { status: 400 });
  }

  const blob = await put(`resumes/${user.id}/${Date.now()}-${file.name}`, file, {
    access: "private",
  });

  let content;
  try {
    content = await parseResumeText(rawText);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI parsing failed" },
      { status: 502 }
    );
  }

  const db = getDb();
  const [saved] = await db
    .insert(resumes)
    .values({
      userId: user.id,
      kind: "uploaded_original",
      fileName: file.name,
      blobUrl: blob.url,
      content,
    })
    .returning();

  return NextResponse.json({ resume: saved });
}
