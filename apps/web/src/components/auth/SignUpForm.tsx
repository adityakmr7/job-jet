"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authErrorMessage, signUp } from "@/lib/auth-client";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/auth/constants";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { AuthCard, Divider } from "./AuthCard";
import { GoogleButton } from "./GoogleButton";
import { PasswordInput } from "./PasswordInput";

export function SignUpForm({ redirectTo, googleEnabled }: { redirectTo: string; googleEnabled: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
      return;
    }
    setPending(true);
    setError(null);
    const { data, error } = await signUp.email({
      name: name.trim() || email.split("@")[0],
      email,
      password,
      callbackURL: `/verify-email?verified=1&redirect=${encodeURIComponent(redirectTo)}`,
    });
    if (error) {
      setError(authErrorMessage(error));
      setPending(false);
      return;
    }
    // No session yet => email verification is required first.
    if (!data?.token) {
      router.replace(`/verify-email?email=${encodeURIComponent(email)}&sent=1`);
      return;
    }
    router.replace(redirectTo);
    router.refresh();
  }

  const signInHref = redirectTo === "/dashboard" ? "/sign-in" : `/sign-in?redirect=${encodeURIComponent(redirectTo)}`;

  return (
    <AuthCard
      title="Create your account"
      description="Free while in beta. Set up your profile once and apply anywhere."
      footer={
        <>
          Already have an account?{" "}
          <Link href={signInHref} className="font-semibold text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {googleEnabled && (
        <>
          <GoogleButton callbackURL={redirectTo} label="Sign up with Google" />
          <Divider label="or with email" />
        </>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Full name" htmlFor="name">
          <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        </Field>
        <Field label="Email" htmlFor="email" required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          required
          hint={tooShort ? `${MIN_PASSWORD_LENGTH - password.length} more characters to go` : `At least ${MIN_PASSWORD_LENGTH} characters. A short phrase works well.`}
        >
          <PasswordInput
            id="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            maxLength={MAX_PASSWORD_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="password-hint"
            aria-invalid={tooShort || undefined}
          />
        </Field>
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" size="lg" className="w-full mt-1" disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </Button>
        <p className="text-xs text-muted text-center leading-relaxed">
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline hover:text-foreground">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </p>
      </form>
    </AuthCard>
  );
}
