import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/db";
import { applications } from "@/db/schema";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { corsHeaders } from "@/lib/cors";

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function GET(req: Request) {
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
}

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
export async function POST(req: Request) {
  const headers = corsHeaders(req.headers.get("origin"));
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });

  const body = await req.json().catch(() => null);
  const rawUrl = typeof body?.url === "string" ? body.url : "";
  if (!rawUrl) return NextResponse.json({ error: "Missing url" }, { status: 400, headers });

  let url: string;
  let domain: string;
  try {
    const parsed = new URL(rawUrl);
    parsed.hash = "";
    url = parsed.toString();
    domain = parsed.hostname;
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400, headers });
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of ["company", "jobTitle", "jobDescription", "resumeId", "status"] as const) {
    if (body?.[key] !== undefined) patch[key] = body[key];
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
}
