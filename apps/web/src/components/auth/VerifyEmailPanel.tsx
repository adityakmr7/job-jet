"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleCheck, MailCheck, TriangleAlert } from "lucide-react";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { Button, ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { AuthCard } from "./AuthCard";

export function VerifyEmailPanel({
  email,
  verified,
  linkError,
  redirectTo,
}: {
  email?: string;
  verified: boolean;
  linkError?: string;
  redirectTo: string;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  if (verified && !linkError) {
    return (
      <AuthCard title="Email verified">
        <div className="flex flex-col items-center text-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success">
            <CircleCheck className="w-6 h-6" aria-hidden />
          </span>
          <p className="text-sm text-muted">Thanks — your email is confirmed and you&apos;re signed in.</p>
          <ButtonLink href={redirectTo} size="lg" className="w-full">
            Continue
          </ButtonLink>
        </div>
      </AuthCard>
    );
  }

  async function resend() {
    if (!email) return;
    setPending(true);
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: `/verify-email?verified=1&redirect=${encodeURIComponent(redirectTo)}`,
    });
    setPending(false);
    setMessage(error ? { tone: "error", text: authErrorMessage(error) } : { tone: "success", text: "Sent — check your inbox." });
  }

  return (
    <AuthCard
      title={linkError ? "That link didn't work" : "Verify your email"}
      footer={
        <Link href="/sign-in" className="font-semibold text-accent hover:underline">
          Back to sign in
        </Link>
      }
    >
      <div className="flex flex-col items-center text-center gap-4">
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-full ${linkError ? "bg-warning-soft text-warning" : "bg-accent-soft text-accent"}`}
        >
          {linkError ? <TriangleAlert className="w-6 h-6" aria-hidden /> : <MailCheck className="w-6 h-6" aria-hidden />}
        </span>
        <p className="text-sm text-muted leading-relaxed">
          {linkError
            ? "Verification links expire after 24 hours and work once. Send yourself a new one below."
            : email
              ? <>We sent a verification link to <strong className="text-foreground">{email}</strong>. Click it to activate your account.</>
              : "Check your inbox for a verification link."}
        </p>
        {email && (
          <Button variant="secondary" className="w-full" onClick={resend} disabled={pending}>
            {pending ? "Sending…" : "Resend verification email"}
          </Button>
        )}
        {message && (
          <Alert tone={message.tone} className="w-full text-left">
            {message.text}
          </Alert>
        )}
      </div>
    </AuthCard>
  );
}
