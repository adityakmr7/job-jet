import { currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { ProfileEditor } from "./ProfileEditor";

export default async function DashboardPage() {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  const db = getDb();
  const [profile] = user
    ? await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1)
    : [];

  return (
    <main className="flex-1 p-8">
      <h1 className="text-2xl font-semibold mb-1">Your profile</h1>
      <p className="opacity-70 text-sm mb-8">
        This is what the extension autofills from, and what tailored resumes are built out of.
      </p>
      <ProfileEditor
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
        defaultEmail={email}
        defaultName={user?.fullName ?? ""}
      />
    </main>
  );
}
