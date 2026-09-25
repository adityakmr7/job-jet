"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authErrorMessage, signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { AuthCard, Divider } from "./AuthCard";
import { GoogleButton } from "./GoogleButton";
import { PasswordInput } from "./PasswordInput";

const NOTICES: Record<string, { tone: "success" | "error" | "info"; text: string }> = {
  "password-reset": { tone: "success", text: "Password updated. Sign in with your new password." },
  verified: { tone: "success", text: "Email verified. You can sign in now." },
  oauth: { tone: "error", text: "Google sign-in didn't complete. Please try again." },
  account_not_linked: {
    tone: "error",
    text: "This Google account matches an existing Job Jet account that hasn't verified its email yet. Sign in with your password (or reset it) first.",
  },
  "account-deleted": { tone: "info", text: "Your account and all of its data have been deleted." },
};

export function SignInForm({
  redirectTo,
  googleEnabled,
  notice,
}: {
  redirectTo: string;
  googleEnabled: boolean;
  notice?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const banner = notice ? NOTICES[notice] : undefined;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setUnverified(false);
    const { error } = await signIn.email({ email, password, callbackURL: redirectTo, rememberMe: true });
    if (error) {
      setUnverified(error.code === "EMAIL_NOT_VERIFIED");
      setError(authErrorMessage(error));
      setPending(false);
      return;
    }
    router.replace(redirectTo);
    router.refresh();
  }

  const signUpHref = redirectTo === "/dashboard" ? "/sign-up" : `/sign-up?redirect=${encodeURIComponent(redirectTo)}`;

  return (
    <AuthCard
      title="Sign in to Job Jet"
      description="Welcome back. Pick up where you left off."
      footer={
        <>
          New to Job Jet?{" "}
          <Link href={signUpHref} className="font-semibold text-accent hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {banner && (
        <Alert tone={banner.tone} className="mb-5">
          {banner.text}
        </Alert>
      )}
      {googleEnabled && (
        <>
          <GoogleButton callbackURL={redirectTo} />
          <Divider label="or with email" />
        </>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate={false}>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? "signin-error" : undefined}
          />
        </Field>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-[13px] font-medium">
              Password
            </label>
            <Link href="/forgot-password" className="text-xs font-medium text-accent hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? "signin-error" : undefined}
          />
        </div>
        {error && (
          <div id="signin-error">
            <Alert tone="error">
              {error}
              {unverified && (
                <>
                  {" "}
                  <Link href={`/verify-email?email=${encodeURIComponent(email)}`} className="underline">
                    Resend verification email
                  </Link>
                </>
              )}
            </Alert>
          </div>
        )}
        <Button type="submit" size="lg" className="w-full mt-1" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthCard>
  );
}
