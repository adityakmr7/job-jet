import type { Metadata } from "next";
import { AuthLayout } from "@/components/AuthLayout";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = { title: "Choose a new password", referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;
  return (
    <AuthLayout title="Locked out? It happens. Let's get you back in.">
      <ResetPasswordForm token={token} linkError={error} />
    </AuthLayout>
  );
}
