import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ProfileSchema } from "@job-jet/shared";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { getOrCreateUser } from "@/lib/get-or-create-user";

const ProfileInputSchema = ProfileSchema.omit({ id: true, userId: true, updatedAt: true });

export async function GET() {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1);

  return NextResponse.json({ profile: profile ?? null });
}

export async function PUT(req: Request) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = ProfileInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid profile", issues: parsed.error.flatten() }, { status: 400 });
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

  return NextResponse.json({ profile: saved });
}
