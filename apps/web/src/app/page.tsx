import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-semibold">Job Jet</h1>
      <p className="max-w-md text-sm opacity-70">
        Save your profile once. The extension recognizes job application
        forms anywhere and autofills them, or generates a resume tailored to
        the specific job description.
      </p>

      <Show when="signed-out">
        <div className="flex gap-3">
          <Link href="/sign-in" className="rounded-full bg-violet-700 text-white px-5 py-2 text-sm font-semibold">
            Sign in
          </Link>
          <Link href="/sign-up" className="rounded-full border border-violet-700 text-violet-700 px-5 py-2 text-sm font-semibold">
            Sign up
          </Link>
        </div>
      </Show>

      <Show when="signed-in">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="rounded-full bg-violet-700 text-white px-5 py-2 text-sm font-semibold">
            Go to dashboard
          </Link>
          <UserButton />
        </div>
      </Show>
    </main>
  );
}
