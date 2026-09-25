"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { AuthCard } from "./AuthCard";

export function ForgotPasswordForm({ emailEnabled }: { emailEnabled: boolean }) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setPending(false);
    // Same message whether or not the account exists (no account enumeration).
    if (error && error.status === 429) {
      setError(authErrorMessage(error));
      return;
    }
    setSent(true);
  }

  const backToSignIn = (
    <Link href="/sign-in" className="font-semibold text-accent hover:underline">
      Back to sign in
    </Link>
  );

  if (sent) {
    return (
      <AuthCard title="Check your inbox" footer={backToSignIn}>
        <div className="flex flex-col items-center text-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
            <MailCheck className="w-6 h-6" aria-hidden />
          </span>
          <p className="text-sm text-muted leading-relaxed" role="status">
            If an account exists for <strong className="text-foreground">{email}</strong>, we&apos;ve sent a link to
            reset its password. The link expires in 1 hour.
          </p>
          <p className="text-xs text-muted">
            Signed up with Google? Just use &ldquo;Continue with Google&rdquo; — there&apos;s no password to reset.
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      description="Enter the email you signed up with and we'll send you a reset link."
      footer={backToSignIn}
    >
      {!emailEnabled && (
        <Alert tone="info" className="mb-5">
          Email delivery isn&apos;t configured on this server yet — in development the reset link is printed to the
          server console.
        </Alert>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </AuthCard>
  );
}
