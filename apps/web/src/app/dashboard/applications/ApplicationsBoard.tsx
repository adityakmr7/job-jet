"use client";

import { useState } from "react";
import { ExternalLink, Trash2, KanbanSquare } from "lucide-react";
import type { ApplicationStatus } from "@job-jet/shared";

type ApplicationSummary = {
  id: string;
  url: string;
  domain: string;
  company: string | null;
  jobTitle: string | null;
  notes: string | null;
  resumeId: string | null;
  status: ApplicationStatus;
  updatedAt: string;
};

type ResumeOption = { id: string; fileName: string };

const STATUS_ORDER: ApplicationStatus[] = ["detected", "draft", "applied", "interviewing", "offer", "rejected"];
const STATUS_LABELS: Record<ApplicationStatus, string> = {
  detected: "Detected",
  draft: "In progress",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
};

const select =
  "rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium transition-colors " +
  "focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent";

export function ApplicationsBoard({
  initialApplications,
  resumes,
}: {
  initialApplications: ApplicationSummary[];
  resumes: ResumeOption[];
}) {
  const [items, setItems] = useState(initialApplications);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function patch(id: string, body: Record<string, unknown>) {
    setSavingId(id);
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Update failed (${res.status})`);
      const { application } = await res.json();
      setItems((prev) => prev.map((a) => (a.id === id ? { ...a, ...application } : a)));
    } catch {
      // Best-effort: leave the optimistic UI as the user set it; a failed
      // save just means it'll look wrong until their next successful edit.
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this application from your tracker? This can't be undone.")) return;
    setItems((prev) => prev.filter((a) => a.id !== id));
    await fetch(`/api/applications/${id}`, { method: "DELETE" }).catch(() => {});
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border-strong p-10 text-center">
        <KanbanSquare className="w-8 h-8 text-muted mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-sm text-muted max-w-sm mx-auto">
          No applications tracked yet. Use the extension&apos;s <strong>Autofill</strong> or{" "}
          <strong>Generate tailored resume</strong> button on a job page — it starts tracking that
          application here automatically.
        </p>
      </div>
    );
  }

  const grouped = STATUS_ORDER.map((status) => ({
    status,
    apps: items.filter((a) => a.status === status),
  })).filter((g) => g.apps.length > 0);

  return (
    <div className="flex flex-col gap-8">
      {grouped.map(({ status, apps }) => (
        <section key={status}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">
            {STATUS_LABELS[status]} <span className="text-muted/70">({apps.length})</span>
          </h2>
          <div className="flex flex-col gap-3">
            {apps.map((app) => (
              <div
                key={app.id}
                className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{app.jobTitle || app.domain}</h3>
                      <a
                        href={app.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted hover:text-accent transition-colors shrink-0"
                        title="Open job posting"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                    <p className="text-xs text-muted mt-0.5">
                      {[app.company, app.domain].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(app.id)}
                    className="shrink-0 text-muted hover:text-red-500 transition-colors"
                    title="Remove from tracker"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-4">
                  <select
                    className={select}
                    value={app.status}
                    disabled={savingId === app.id}
                    onChange={(e) => patch(app.id, { status: e.target.value })}
                  >
                    {STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>

                  <select
                    className={select}
                    value={app.resumeId ?? ""}
                    disabled={savingId === app.id}
                    onChange={(e) => patch(app.id, { resumeId: e.target.value || null })}
                  >
                    <option value="">No resume linked</option>
                    {resumes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.fileName}
                      </option>
                    ))}
                  </select>
                </div>

                <textarea
                  className="w-full mt-3 rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  placeholder="Notes — recruiter contact, follow-up date, interview prep..."
                  rows={2}
                  defaultValue={app.notes ?? ""}
                  onBlur={(e) => {
                    if (e.target.value !== (app.notes ?? "")) patch(app.id, { notes: e.target.value });
                  }}
                />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
