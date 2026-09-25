import type { Metadata } from "next";
import { connection } from "next/server";
import { AuthLayout } from "@/components/AuthLayout";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { isEmailProviderConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Reset your password" };

export default async function ForgotPasswordPage() {
  await connection(); // read env at request time, not build time
  return (
    <AuthLayout title="Locked out? It happens. Let's get you back in.">
      <ForgotPasswordForm emailEnabled={isEmailProviderConfigured() || process.env.NODE_ENV !== "production"} />
    </AuthLayout>
  );
}
