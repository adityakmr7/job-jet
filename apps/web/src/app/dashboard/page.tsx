import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles, resumes } from "@/db/schema";
import { DashboardShell } from "@/components/DashboardShell";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  // Resource-level check, not just the proxy.ts matcher — Clerk's own
  // guidance (createRouteMatcher deprecation notice) is that middleware
  // path-matching can diverge from actual routing, so every protected
  // resource should also protect itself.
  const { isAuthenticated } = await auth();
  if (!isAuthenticated) redirect("/sign-in?redirect_url=/dashboard");

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  const db = getDb();
  const [profile] = user
    ? await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1)
    : [];
  const resumeRows = user
    ? await db.select().from(resumes).where(eq(resumes.userId, user.id)).orderBy(desc(resumes.createdAt))
    : [];

  return (
    <DashboardShell
      title="Your profile"
      description="This is what the extension autofills from, and what tailored resumes are built out of."
      email={email}
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
          content: r.content,
        }))}
        defaultEmail={email}
        defaultName={user?.fullName ?? ""}
      />
    </DashboardShell>
  );
}
