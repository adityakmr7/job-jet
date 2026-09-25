import { NextResponse, after } from "next/server";
import { put, del } from "@vercel/blob";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/db";
import { resumes } from "@/db/schema";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { extractResumeText } from "@/lib/extract-text";
import { parseResumeText } from "@/lib/resume-parse";
import { withErrorHandling } from "@/lib/http";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { LIMITS } from "@/lib/validation";

// Note: Vercel Functions cap request bodies at ~4.5MB, which is below this
// limit on that platform; the check still guards other hosts.
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const GET = withErrorHandling("api/resume GET", async () => {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const rows = await db
    .select()
    .from(resumes)
    .where(eq(resumes.userId, user.id))
    .orderBy(desc(resumes.createdAt));

  return NextResponse.json({ resumes: rows });
});

/** Best-effort removal of an orphaned upload; never masks the original error. */
function deleteBlobLater(url: string) {
  after(() =>
    del(url).catch((err) => console.error("[api/resume] failed to delete orphaned blob:", url, err))
  );
}

/** Uploads a resume file, extracts its text, stores the original in Blob,
 *  and has the model structure it into the canonical Profile-compatible shape. */
export const POST = withErrorHandling("api/resume POST", async (req: Request) => {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const declaredLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_FILE_SIZE + 64 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  const limited = await enforceRateLimit(RATE_LIMITS.resumeParse, user.id);
  if (limited) return limited;

  let rawText: string;
  try {
    rawText = await extractResumeText(file);
  } catch (err) {
    console.error("[api/resume] text extraction failed:", err);
    return NextResponse.json(
      { error: err instanceof Error && err.message.startsWith("Unsupported") ? err.message : "Couldn't read that file" },
      { status: 400 }
    );
  }
  if (!rawText.trim()) {
    return NextResponse.json({ error: "Couldn't extract any text from that file" }, { status: 400 });
  }
  // Bound what goes into the model prompt; real resumes are far shorter.
  rawText = rawText.slice(0, LIMITS.resumeTextChars);

  const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 150) || "resume";
  const blob = await put(`resumes/${user.id}/${Date.now()}-${safeName}`, file, {
    access: "private",
  });

  let content;
  try {
    content = await parseResumeText(rawText);
  } catch (err) {
    console.error("[api/resume] AI parsing failed:", err);
    deleteBlobLater(blob.url);
    return NextResponse.json({ error: "AI parsing failed — please try again." }, { status: 502 });
  }

  try {
    const db = getDb();
    const [saved] = await db
      .insert(resumes)
      .values({
        userId: user.id,
        kind: "uploaded_original",
        fileName: file.name.slice(0, 255),
        blobUrl: blob.url,
        content,
      })
      .returning();

    return NextResponse.json({ resume: saved });
  } catch (err) {
    deleteBlobLater(blob.url);
    throw err;
  }
});
