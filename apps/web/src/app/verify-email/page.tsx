import type { Metadata } from "next";
import { AuthLayout } from "@/components/AuthLayout";
import { VerifyEmailPanel } from "@/components/auth/VerifyEmailPanel";
import { safeRedirectPath } from "@/lib/auth/origins";

export const metadata: Metadata = { title: "Verify your email" };

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const params = await searchParams;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  return (
    <AuthLayout title="One quick step to keep your account yours.">
      <VerifyEmailPanel
        email={str(params.email)}
        verified={params.verified === "1"}
        linkError={str(params.error)}
        redirectTo={safeRedirectPath(str(params.redirect))}
      />
    </AuthLayout>
  );
}
