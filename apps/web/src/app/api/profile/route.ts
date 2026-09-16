import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ProfileSchema } from "@job-jet/shared";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { corsHeaders } from "@/lib/cors";

const ProfileInputSchema = ProfileSchema.omit({ id: true, userId: true, updatedAt: true });

// Preflight for the extension's cross-origin (chrome-extension://) requests.
// Handled here rather than only in proxy.ts because auth.protect() must not
// run against the unauthenticated OPTIONS preflight, or the CORS handshake
// itself gets blocked before the browser ever sends the real request.
export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function GET(req: Request) {
  const headers = corsHeaders(req.headers.get("origin"));
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });

  const db = getDb();
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1);

  return NextResponse.json({ profile: profile ?? null }, { headers });
}

export async function PUT(req: Request) {
  const headers = corsHeaders(req.headers.get("origin"));
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });

  const body = await req.json().catch(() => null);
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
}
