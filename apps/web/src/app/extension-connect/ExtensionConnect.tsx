"use client";

import { useState } from "react";
import { CircleCheck, Puzzle, ShieldCheck } from "lucide-react";
import { buildConnectMessage } from "@/lib/auth/extension-connect";
import { Button, ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { AuthCard } from "@/components/auth/AuthCard";

type ChromeRuntime = {
  sendMessage: (extensionId: string, message: unknown, callback: (response: unknown) => void) => void;
  lastError?: { message?: string };
};

function getRuntime(): ChromeRuntime | null {
  const runtime = (globalThis as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime;
  return runtime && typeof runtime.sendMessage === "function" ? runtime : null;
}

function sendToExtension(runtime: ChromeRuntime, extensionId: string, message: unknown): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      runtime.sendMessage(extensionId, message, (response) => {
        if (runtime.lastError) return resolve(false);
        resolve(Boolean(response && (response as { ok?: unknown }).ok === true));
      });
    } catch {
      resolve(false);
    }
  });
}

export function ExtensionConnect({ extensionId, state, email }: { extensionId: string; state: string; email: string }) {
  const [status, setStatus] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setStatus("pending");
    setError(null);
    const runtime = getRuntime();
    if (!runtime) {
      setStatus("error");
      setError("We couldn't reach the Job Jet extension from this page. Make sure it's installed and enabled in this Chrome profile, then click Connect again from the side panel.");
      return;
    }
    const res = await fetch("/api/auth/extension/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extensionId }),
      credentials: "same-origin",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || typeof body.token !== "string") {
      setStatus("error");
      setError(res.status === 429 ? "Too many attempts — wait a minute and try again." : "Couldn't create a session for the extension. Please try again.");
      return;
    }
    const ok = await sendToExtension(runtime, extensionId, buildConnectMessage({ state, token: body.token, expiresAt: body.expiresAt, user: body.user }));
    if (!ok) {
      // Don't leave an unused session behind.
      const rawToken = decodeURIComponent(body.token).split(".")[0];
      fetch("/api/auth/revoke-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: rawToken }),
        credentials: "same-origin",
      }).catch(() => {});
      setStatus("error");
      setError("The extension didn't accept the connection — this link may be stale. Click “Connect to Job Jet” in the side panel to start again.");
      return;
    }
    setStatus("done");
  }

  if (status === "done") {
    return (
      <AuthCard title="Extension connected">
        <div className="flex flex-col items-center text-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success">
            <CircleCheck className="w-6 h-6" aria-hidden />
          </span>
          <p className="text-sm text-muted" role="status">
            You&apos;re all set. Head back to the Job Jet side panel — this tab closes on its own.
          </p>
          <ButtonLink href="/dashboard" variant="secondary" className="w-full">
            Go to your dashboard
          </ButtonLink>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Connect the Job Jet extension"
      description={
        <>
          The extension will be able to read your profile, tailor resumes and update your tracker as{" "}
          <strong className="text-foreground">{email}</strong>.
        </>
      }
    >
      <ul className="mb-6 space-y-3 text-sm">
        <li className="flex gap-3">
          <Puzzle className="w-4 h-4 mt-0.5 text-accent shrink-0" aria-hidden />
          <span>Only this browser&apos;s Job Jet extension receives access — nothing is shared with the sites you visit.</span>
        </li>
        <li className="flex gap-3">
          <ShieldCheck className="w-4 h-4 mt-0.5 text-accent shrink-0" aria-hidden />
          <span>Disconnect any time from the side panel or from Account settings.</span>
        </li>
      </ul>
      {error && (
        <Alert tone="error" className="mb-4">
          {error}
        </Alert>
      )}
      <Button size="lg" className="w-full" onClick={connect} disabled={status === "pending"}>
        {status === "pending" ? "Connecting…" : "Connect extension"}
      </Button>
    </AuthCard>
  );
}
