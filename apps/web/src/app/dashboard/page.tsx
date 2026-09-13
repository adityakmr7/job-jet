import { currentUser } from "@clerk/nextjs/server";

export default async function DashboardPage() {
  const user = await currentUser();

  return (
    <main className="flex-1 p-8">
      <h1 className="text-2xl font-semibold mb-2">Dashboard</h1>
      <p className="opacity-70 text-sm">
        Signed in as {user?.primaryEmailAddress?.emailAddress ?? "unknown"}.
      </p>
      {/* TODO: profile editor, resume upload, application history */}
    </main>
  );
}
