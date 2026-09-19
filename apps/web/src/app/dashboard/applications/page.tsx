import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/db";
import { applications, resumes } from "@/db/schema";
import { DashboardShell } from "@/components/DashboardShell";
import { ApplicationsBoard } from "./ApplicationsBoard";

export default async function ApplicationsPage() {
  const { isAuthenticated } = await auth();
  if (!isAuthenticated) redirect("/sign-in?redirect_url=/dashboard/applications");

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  const db = getDb();
  const [applicationRows, resumeRows] = user
    ? await Promise.all([
        db.select().from(applications).where(eq(applications.userId, user.id)).orderBy(desc(applications.updatedAt)),
        db.select().from(resumes).where(eq(resumes.userId, user.id)).orderBy(desc(resumes.createdAt)),
      ])
    : [[], []];

  return (
    <DashboardShell
      title="Applications"
      description="Every job you've autofilled or tailored a resume for, tracked automatically — update status and add notes as you go."
      email={email}
    >
      <ApplicationsBoard
        initialApplications={applicationRows.map((a) => ({
          id: a.id,
          url: a.url,
          domain: a.domain,
          company: a.company,
          jobTitle: a.jobTitle,
          notes: a.notes,
          resumeId: a.resumeId,
          status: a.status,
          updatedAt: a.updatedAt.toISOString(),
        }))}
        resumes={resumeRows.map((r) => ({ id: r.id, fileName: r.fileName }))}
      />
    </DashboardShell>
  );
}
