import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/AuthLayout";
import { SignInForm } from "@/components/auth/SignInForm";
import { getSession } from "@/lib/auth/session";
import { safeRedirectPath } from "@/lib/auth/origins";
import { isGoogleEnabled } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const redirectTo = safeRedirectPath(typeof params.redirect === "string" ? params.redirect : undefined);
  if (await getSession()) redirect(redirectTo);
  const notice = typeof params.notice === "string" ? params.notice : typeof params.error === "string" ? params.error : undefined;
  return (
    <AuthLayout title="Welcome back. Let's get you through some applications.">
      <SignInForm redirectTo={redirectTo} googleEnabled={isGoogleEnabled()} notice={notice} />
    </AuthLayout>
  );
}
