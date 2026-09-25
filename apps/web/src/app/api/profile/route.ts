import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { corsHeaders } from "@/lib/cors";
import { readJsonBody, withErrorHandling } from "@/lib/http";
import { ProfileInputSchema } from "@/lib/validation";

// A full profile (many roles, bullets, links) is comfortably under this.
const MAX_PROFILE_BYTES = 200 * 1024;

// Preflight for the extension's cross-origin (chrome-extension://) requests.
// Handled here rather than only in proxy.ts because auth.protect() must not
// run against the unauthenticated OPTIONS preflight, or the CORS handshake
// itself gets blocked before the browser ever sends the real request.
export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export const GET = withErrorHandling("api/profile GET", async (req: Request) => {
  const headers = corsHeaders(req.headers.get("origin"));
  const user = await requireUser(req);

  const db = getDb();
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1);

  return NextResponse.json({ profile: profile ?? null }, { headers });
});

export const PUT = withErrorHandling("api/profile PUT", async (req: Request) => {
  const headers = corsHeaders(req.headers.get("origin"));
  const user = await requireUser(req);

  const body = await readJsonBody(req, MAX_PROFILE_BYTES);
  const parsed = ProfileInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid profile", issues: parsed.error.flatten() },
      { status: 400, headers }
    );
  }

  const db = getDb();
  const [saved] = await db
    .insert(profiles)
    .values({ ...parsed.data, userId: user.id, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: profiles.userId,
      set: { ...parsed.data, updatedAt: new Date() },
    })
    .returning();

  return NextResponse.json({ profile: saved }, { headers });
});
