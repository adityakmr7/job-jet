import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/db";
import { applications } from "@/db/schema";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { corsHeaders } from "@/lib/cors";
import { readJsonBody, withErrorHandling } from "@/lib/http";
import { ApplicationUpsertSchema, validationErrorBody } from "@/lib/validation";
import { userOwnsResume } from "@/lib/ownership";

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export const GET = withErrorHandling("api/applications GET", async (req: Request) => {
  const headers = corsHeaders(req.headers.get("origin"));
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });

  const db = getDb();
  const rows = await db
    .select()
    .from(applications)
    .where(eq(applications.userId, user.id))
    .orderBy(desc(applications.updatedAt));

  return NextResponse.json({ applications: rows }, { headers });
});

/**
 * Upserts by (userId, url) — called by the extension whenever the user
 * meaningfully engages with a detected job page (autofilling or
 * generating a tailored resume for it), not on every page visit. Repeat
 * engagement with the same posting updates the existing row rather than
 * creating a duplicate; an explicit `status` is only applied if the
 * caller sends one; the DB default ("detected") only takes effect on the
 * very first insert.
 *
 * The hash fragment is stripped before dedup/storage — found by testing
 * against a real multi-step wizard fixture, where each step changes the
 * URL hash (#personal, #resume, #experience...) via history.pushState.
 * Without stripping it, autofilling across a 5-step wizard created 5
 * separate tracker entries for what is obviously one application. Query
 * params are left as-is: some ATS URLs encode the actual job id there, so
 * stripping them isn't safe to do blindly the way the hash is (referral
 * UTM params on those same URLs are a related, unfixed risk — noted, not
 * solved, since a real fix needs knowing which params are noise per site).
 */
export const POST = withErrorHandling("api/applications POST", async (req: Request) => {
  const headers = corsHeaders(req.headers.get("origin"));
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });

  const parsedBody = ApplicationUpsertSchema.safeParse(await readJsonBody(req));
  if (!parsedBody.success) {
    return NextResponse.json(validationErrorBody(parsedBody.error), { status: 400, headers });
  }
  const { url: rawUrl, ...fields } = parsedBody.data;

  let url: string;
  let domain: string;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("bad protocol");
    parsed.hash = "";
    url = parsed.toString();
    domain = parsed.hostname;
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400, headers });
  }

  if (fields.resumeId && !(await userOwnsResume(user.id, fields.resumeId))) {
    return NextResponse.json({ error: "Resume not found" }, { status: 400, headers });
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) patch[key] = value;
  }

  const db = getDb();
  const [saved] = await db
    .insert(applications)
    .values({ userId: user.id, url, domain, ...patch })
    .onConflictDoUpdate({
      target: [applications.userId, applications.url],
      set: patch,
    })
    .returning();

  return NextResponse.json({ application: saved }, { headers });
});
