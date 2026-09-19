import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/db";
import { applications, applicationStatusEnum } from "@/db/schema";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { corsHeaders } from "@/lib/cors";

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

const STATUSES = new Set(applicationStatusEnum.enumValues);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = corsHeaders(req.headers.get("origin"));
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });

  const { id } = await params;
  const body = await req.json().catch(() => null);

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of ["company", "jobTitle", "jobDescription", "notes", "resumeId"] as const) {
    if (body?.[key] !== undefined) patch[key] = body[key];
  }
  if (body?.status !== undefined) {
    if (!STATUSES.has(body.status)) {
      return NextResponse.json({ error: `Invalid status: ${body.status}` }, { status: 400, headers });
    }
    patch.status = body.status;
  }

  const db = getDb();
  const [updated] = await db
    .update(applications)
    .set(patch)
    .where(and(eq(applications.id, id), eq(applications.userId, user.id)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  return NextResponse.json({ application: updated }, { headers });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = corsHeaders(req.headers.get("origin"));
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });

  const { id } = await params;
  const db = getDb();
  const [deleted] = await db
    .delete(applications)
    .where(and(eq(applications.id, id), eq(applications.userId, user.id)))
    .returning({ id: applications.id });

  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  return NextResponse.json({ ok: true }, { headers });
}
