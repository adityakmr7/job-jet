"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Laptop, Puzzle, ShieldAlert, UserRound } from "lucide-react";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/auth/constants";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert, Skeleton, Toast } from "@/components/ui/feedback";
import { PasswordInput } from "@/components/auth/PasswordInput";

type SessionRow = { id: string; token: string; userAgent?: string | null; createdAt: string | Date; updatedAt: string | Date };

function describeSession(userAgent: string | null | undefined): { label: string; extension: boolean } {
  if (userAgent?.startsWith("Job Jet extension")) return { label: "Job Jet Chrome extension", extension: true };
  if (!userAgent) return { label: "Unknown device", extension: false };
  const browser = /Edg\//.test(userAgent) ? "Edge" : /Chrome\//.test(userAgent) ? "Chrome" : /Firefox\//.test(userAgent) ? "Firefox" : /Safari\//.test(userAgent) ? "Safari" : "Browser";
  const os = /Windows/.test(userAgent) ? "Windows" : /Mac OS X/.test(userAgent) ? "macOS" : /Android/.test(userAgent) ? "Android" : /iPhone|iPad/.test(userAgent) ? "iOS" : /Linux/.test(userAgent) ? "Linux" : "";
  return { label: os ? `${browser} on ${os}` : browser, extension: false };
}

export function AccountSettings({ email, name, emailVerified }: { email: string; name: string; emailVerified: boolean }) {
  const router = useRouter();
  const { data: current } = authClient.useSession();
  const [providers, setProviders] = useState<string[] | null>(null);
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [sessionsError, setSessionsError] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadSessions = useCallback(() => {
    authClient.listSessions().then(({ data, error }) => {
      if (error) setSessionsError(true);
      else setSessions((data ?? []) as SessionRow[]);
    });
  }, []);

  useEffect(() => {
    authClient.listAccounts().then(({ data }) => setProviders((data ?? []).map((a) => a.providerId)));
    authClient.listSessions().then(({ data, error }) => {
      if (error) setSessionsError(true);
      else setSessions((data ?? []) as SessionRow[]);
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const hasPassword = providers?.includes("credential") ?? false;
  const hasGoogle = providers?.includes("google") ?? false;

  async function revoke(token: string) {
    await authClient.revokeSession({ token });
    setToast("Signed out of that device.");
    loadSessions();
  }

  return (
    <div className="flex flex-col gap-6">
      <Card aria-labelledby="account-heading">
        <CardHeader id="account-heading" title="Your account" icon={<UserRound className="w-4 h-4" aria-hidden />} />
        <dl className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted text-xs font-medium">Name</dt>
            <dd className="mt-1 font-medium">{name || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted text-xs font-medium">Email</dt>
            <dd className="mt-1 font-medium flex items-center gap-2 flex-wrap">
              {email}
              <Badge tone={emailVerified ? "success" : "warning"}>{emailVerified ? "Verified" : "Not verified"}</Badge>
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted text-xs font-medium">Sign-in methods</dt>
            <dd className="mt-1.5 flex gap-2 flex-wrap">
              {providers === null ? (
                <Skeleton className="h-6 w-40" />
              ) : (
                <>
                  {hasPassword && <Badge tone="neutral">Email &amp; password</Badge>}
                  {hasGoogle && <Badge tone="neutral">Google</Badge>}
                  {!hasPassword && !hasGoogle && <span className="text-muted">None yet</span>}
                </>
              )}
            </dd>
          </div>
        </dl>
      </Card>

      <Card aria-labelledby="password-heading">
        <CardHeader
          id="password-heading"
          title="Password"
          description={hasPassword ? "Changing it signs you out everywhere else, including the extension." : undefined}
          icon={<KeyRound className="w-4 h-4" aria-hidden />}
        />
        {providers === null ? (
          <Skeleton className="h-24 w-full" />
        ) : hasPassword ? (
          <ChangePasswordForm onDone={() => { setToast("Password updated."); loadSessions(); }} />
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-muted">
            <p>You sign in with Google, so there&apos;s no password on this account.</p>
            <ButtonLink href="/forgot-password" variant="secondary" size="sm">
              Add a password
            </ButtonLink>
          </div>
        )}
      </Card>

      <Card aria-labelledby="sessions-heading">
        <CardHeader
          id="sessions-heading"
          title="Where you're signed in"
          description="Browsers and the Chrome extension with access to your account."
          icon={<Laptop className="w-4 h-4" aria-hidden />}
        />
        {sessionsError ? (
          <Alert tone="info">For your security, sign in again to see your devices.</Alert>
        ) : sessions === null ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {sessions.map((s) => {
              const { label, extension } = describeSession(s.userAgent);
              const isCurrent = current?.session.id === s.id;
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-surface-sunken text-muted">
                      {extension ? <Puzzle className="w-4 h-4" aria-hidden /> : <Laptop className="w-4 h-4" aria-hidden />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {label} {isCurrent && <Badge tone="accent" className="ml-1">This browser</Badge>}
                      </p>
                      <p className="text-xs text-muted">Last active {new Date(s.updatedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  {!isCurrent && (
                    <Button variant="ghost" size="sm" onClick={() => revoke(s.token)} aria-label={`Sign out ${label}`}>
                      {extension ? "Disconnect" : "Sign out"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card aria-labelledby="danger-heading" className="border-danger/25">
        <CardHeader
          id="danger-heading"
          title="Delete account"
          description="Permanently deletes your account, profile, uploaded and tailored resumes (including the files), and application history. This can't be undone."
          icon={<ShieldAlert className="w-4 h-4" aria-hidden />}
        />
        <DeleteAccountForm hasPassword={hasPassword} onDeleted={() => router.replace("/sign-in?notice=account-deleted")} />
      </Card>

      {toast && <Toast>{toast}</Toast>}
    </div>
  );
}

function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < MIN_PASSWORD_LENGTH) return setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
    if (newPassword !== confirm) return setError("The new passwords don't match.");
    setPending(true);
    setError(null);
    const { error } = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
    setPending(false);
    if (error) return setError(authErrorMessage(error));
    setCurrentPassword("");
    setNewPassword("");
    setConfirm("");
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
      <Field label="Current password" htmlFor="current-password" className="sm:col-span-2">
        <PasswordInput id="current-password" autoComplete="current-password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
      </Field>
      <Field label="New password" htmlFor="new-password" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}>
        <PasswordInput
          id="new-password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          maxLength={MAX_PASSWORD_LENGTH}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          aria-describedby="new-password-hint"
        />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm-password">
        <PasswordInput id="confirm-password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      {error && (
        <Alert tone="error" className="sm:col-span-2">
          {error}
        </Alert>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Updating…" : "Update password"}
        </Button>
      </div>
    </form>
  );
}

function DeleteAccountForm({ hasPassword, onDeleted }: { hasPassword: boolean; onDeleted: () => void }) {
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await authClient.deleteUser(hasPassword ? { password } : {});
    setPending(false);
    if (error) return setError(authErrorMessage(error));
    onDeleted();
  }

  return (
    <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
      {hasPassword && (
        <Field label="Your password" htmlFor="delete-password">
          <PasswordInput id="delete-password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
      )}
      <Field label='Type "DELETE" to confirm' htmlFor="delete-confirm">
        <Input id="delete-confirm" autoComplete="off" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
      </Field>
      {error && (
        <Alert tone="error" className="sm:col-span-2">
          {error}
        </Alert>
      )}
      <div className="sm:col-span-2">
        <Button
          type="submit"
          className="bg-danger text-white hover:bg-danger/90"
          disabled={pending || confirmText !== "DELETE" || (hasPassword && !password)}
        >
          {pending ? "Deleting…" : "Delete my account"}
        </Button>
      </div>
    </form>
  );
}
