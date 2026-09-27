import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { corsHeaders } from "@/lib/cors";
import { readJsonBody, withErrorHandling } from "@/lib/http";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { mergeCustomAnswers } from "@/lib/saved-answers";
import { SaveAnswersRequestSchema, validationErrorBody } from "@/lib/validation";

const MAX_BODY_BYTES = 64 * 1024;

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

/**
 * POST /api/profile/answers — the extension's "Save this answer": adds or
 * updates custom saved answers without resending the whole profile.
 * Validated + sanitized (SaveAnswersRequestSchema), size-capped and
 * rate-limited together with profile saves.
 */
export const POST = withErrorHandling("api/profile/answers POST", async (req: Request) => {
  const headers = corsHeaders(req.headers.get("origin"));
  const user = await requireUser(req);

  const limited = await enforceRateLimit(RATE_LIMITS.profileWrite, user.id, headers);
  if (limited) return limited;

  const parsed = SaveAnswersRequestSchema.safeParse(await readJsonBody(req, MAX_BODY_BYTES));
  if (!parsed.success) {
    return NextResponse.json(validationErrorBody(parsed.error), { status: 400, headers });
  }

  const db = getDb();
  const [row] = await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1);
  if (!row) {
    return NextResponse.json({ error: "Create your profile on the Job Jet website first." }, { status: 404, headers });
  }

  const answers = row.applicationAnswers ?? {};
  const merged = mergeCustomAnswers(answers.customAnswers ?? [], parsed.data.answers);
  if (!merged) {
    return NextResponse.json(
      { error: "You can keep up to 50 custom answers. Remove some on the Profile page first." },
      { status: 400, headers }
    );
  }

  await db
    .update(profiles)
    .set({ applicationAnswers: { ...answers, customAnswers: merged }, updatedAt: new Date() })
    .where(eq(profiles.userId, user.id));

  return NextResponse.json({ saved: parsed.data.answers.length }, { headers });
});
