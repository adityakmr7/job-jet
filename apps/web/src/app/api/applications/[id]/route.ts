import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/db";
import { applications } from "@/db/schema";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { corsHeaders } from "@/lib/cors";
import { readJsonBody, withErrorHandling } from "@/lib/http";
import { ApplicationPatchSchema, UuidSchema, validationErrorBody } from "@/lib/validation";
import { userOwnsResume } from "@/lib/ownership";

type RouteContext = { params: Promise<{ id: string }> };

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export const PATCH = withErrorHandling("api/applications/[id] PATCH", async (req: Request, { params }: RouteContext) => {
  const headers = corsHeaders(req.headers.get("origin"));
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });

  const { id } = await params;
  if (!UuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  }

  const parsed = ApplicationPatchSchema.safeParse(await readJsonBody(req));
  if (!parsed.success) {
    return NextResponse.json(validationErrorBody(parsed.error), { status: 400, headers });
  }

  // A resume can only be attached if it's the caller's own.
  if (parsed.data.resumeId && !(await userOwnsResume(user.id, parsed.data.resumeId))) {
    return NextResponse.json({ error: "Resume not found" }, { status: 400, headers });
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) patch[key] = value;
  }

  const db = getDb();
  const [updated] = await db
    .update(applications)
    .set(patch)
    .where(and(eq(applications.id, id), eq(applications.userId, user.id)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  return NextResponse.json({ application: updated }, { headers });
});

export const DELETE = withErrorHandling("api/applications/[id] DELETE", async (req: Request, { params }: RouteContext) => {
  const headers = corsHeaders(req.headers.get("origin"));
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });

  const { id } = await params;
  if (!UuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  }

  const db = getDb();
  const [deleted] = await db
    .delete(applications)
    .where(and(eq(applications.id, id), eq(applications.userId, user.id)))
    .returning({ id: applications.id });

  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  return NextResponse.json({ ok: true }, { headers });
});
