import { requirePageUser } from "@/lib/auth/session";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/db";
import { applications, resumes } from "@/db/schema";
import { DashboardShell } from "@/components/DashboardShell";
import { ApplicationsBoard } from "./ApplicationsBoard";

export default async function ApplicationsPage() {
  const user = await requirePageUser("/dashboard/applications");
  const email = user.email;

  const db = getDb();
  const [applicationRows, resumeRows] = await Promise.all([
    db.select().from(applications).where(eq(applications.userId, user.id)).orderBy(desc(applications.updatedAt)),
    db.select().from(resumes).where(eq(resumes.userId, user.id)).orderBy(desc(resumes.createdAt)),
  ]);

  return (
    <DashboardShell
      title="Applications"
      description="Every job you've autofilled or tailored a resume for, tracked automatically — update status and add notes as you go."
      email={email}
      name={user.name}
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
