import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/AuthLayout";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { getSession } from "@/lib/auth/session";
import { safeRedirectPath } from "@/lib/auth/origins";
import { isGoogleEnabled } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const params = await searchParams;
  const redirectTo = safeRedirectPath(typeof params.redirect === "string" ? params.redirect : undefined);
  if (await getSession()) redirect(redirectTo);
  return (
    <AuthLayout title="Your next application takes two minutes. Let's set you up.">
      <SignUpForm redirectTo={redirectTo} googleEnabled={isGoogleEnabled()} />
    </AuthLayout>
  );
}
