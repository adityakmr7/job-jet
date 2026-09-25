import { eq } from "drizzle-orm";
import { get } from "@vercel/blob";
import { getDb } from "@/db";
import { resumes } from "@/db/schema";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { corsHeaders } from "@/lib/cors";
import { withErrorHandling } from "@/lib/http";
import { UuidSchema } from "@/lib/validation";

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

/** Streams a resume's file. Resumes are stored in a *private* Blob store —
 *  the blobUrl alone isn't fetchable by a browser, this route is the only
 *  path to the bytes, and it checks ownership before serving them. */
export const GET = withErrorHandling(
  "api/resume/[id]/download GET",
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const headers = corsHeaders(req.headers.get("origin"));
  const user = await getOrCreateUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401, headers });

  const { id } = await params;
  if (!UuidSchema.safeParse(id).success) {
    return Response.json({ error: "Not found" }, { status: 404, headers });
  }
  const db = getDb();
  const [resume] = await db.select().from(resumes).where(eq(resumes.id, id)).limit(1);
  if (!resume || resume.userId !== user.id) {
    return Response.json({ error: "Not found" }, { status: 404, headers });
  }

  const blob = await get(resume.blobUrl, { access: "private" });
  if (!blob || blob.statusCode !== 200) {
    return Response.json({ error: "File no longer available" }, { status: 404, headers });
  }

  return new Response(blob.stream, {
    headers: {
      ...headers,
      "Content-Type": blob.blob.contentType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${resume.fileName.replace(/"/g, "")}"`,
    },
  });
  }
);
