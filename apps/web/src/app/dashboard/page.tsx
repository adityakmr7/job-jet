import { requirePageUser } from "@/lib/auth/session";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles, resumes } from "@/db/schema";
import { DashboardShell } from "@/components/DashboardShell";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  // Resource-level check, not just the proxy.ts cookie redirect — the
  // proxy only sees that a cookie exists; this verifies the session.
  const user = await requirePageUser("/dashboard");
  const email = user.email;

  const db = getDb();
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1);
  const resumeRows = await db.select().from(resumes).where(eq(resumes.userId, user.id)).orderBy(desc(resumes.createdAt));

  return (
    <DashboardShell
      title="Your profile"
      description="This is what the extension autofills from, and what tailored resumes are built out of."
      email={email}
      name={user.name}
    >
      <DashboardClient
        initialProfile={
          profile
            ? {
                fullName: profile.fullName,
                email: profile.email,
                phone: profile.phone ?? "",
                location: profile.location ?? "",
                links: profile.links ?? [],
                summary: profile.summary ?? "",
                education: profile.education ?? [],
                experience: profile.experience ?? [],
                skills: profile.skills ?? [],
                workAuthorization: profile.workAuthorization ?? undefined,
                additionalQuestions: profile.additionalQuestions ?? undefined,
              }
            : null
        }
        initialResumes={resumeRows.map((r) => ({
          id: r.id,
          fileName: r.fileName,
          createdAt: r.createdAt.toISOString(),
          kind: r.kind,
          content: r.content,
        }))}
        defaultEmail={email}
        defaultName={user.name ?? ""}
      />
    </DashboardShell>
  );
}
