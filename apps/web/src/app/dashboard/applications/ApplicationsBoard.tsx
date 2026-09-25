"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Trash2, KanbanSquare, Loader2 } from "lucide-react";
import { EmptyState, Toast } from "@/components/ui/feedback";
import { selectClasses, inputClasses } from "@/components/ui/field";
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

const STATUS_DOT: Record<ApplicationStatus, string> = {
  detected: "bg-border-strong",
  draft: "bg-accent",
  applied: "bg-[#6366f1]",
  interviewing: "bg-flare",
  offer: "bg-success",
  rejected: "bg-muted",
};

function formatUpdated(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en", { month: "short", day: "numeric" });
}

export function ApplicationsBoard({
  initialApplications,
  resumes,
}: {
  initialApplications: ApplicationSummary[];
  resumes: ResumeOption[];
}) {
  const [items, setItems] = useState(initialApplications);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

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
      // Leave the optimistic UI as the user set it, but say the save failed
      // so they know to retry.
      setToast({ tone: "error", text: "Couldn't save that change. Please try again." });
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this application from your tracker? This can't be undone.")) return;
    const previous = items;
    setItems((prev) => prev.filter((a) => a.id !== id));
    const res = await fetch(`/api/applications/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setItems(previous);
      setToast({ tone: "error", text: "Couldn't remove that application. Please try again." });
    } else {
      setToast({ tone: "success", text: "Application removed" });
    }
  }

  if (items.length === 0) {
    return (
      <EmptyState icon={<KanbanSquare className="w-6 h-6" aria-hidden />} title="No applications yet">
        Open a job post and use <strong className="text-foreground">Autofill</strong> or{" "}
        <strong className="text-foreground">Tailor resume</strong> in the extension. The application shows up here
        automatically.
      </EmptyState>
    );
  }

  const grouped = STATUS_ORDER.map((status) => ({
    status,
    apps: items.filter((a) => a.status === status),
  })).filter((g) => g.apps.length > 0);

  const stats = [
    { label: "Tracked", value: items.length },
    { label: "Applied", value: items.filter((a) => ["applied", "interviewing", "offer"].includes(a.status)).length },
    { label: "Interviewing", value: items.filter((a) => a.status === "interviewing").length },
    { label: "Offers", value: items.filter((a) => a.status === "offer").length },
  ];

  return (
    <div className="flex flex-col gap-8">
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-[var(--radius-lg)] border border-border bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
            <dt className="text-xs font-medium text-muted">{s.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tracking-tight">{s.value}</dd>
          </div>
        ))}
      </dl>

      {grouped.map(({ status, apps }) => (
        <section key={status} aria-labelledby={`status-${status}`}>
          <h2 id={`status-${status}`} className="flex items-center gap-2 text-sm font-semibold mb-3">
            <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} aria-hidden />
            {STATUS_LABELS[status]}
            <span className="rounded-full bg-surface-hover px-2 py-0.5 text-xs font-medium text-muted">{apps.length}</span>
          </h2>
          <ul className="flex flex-col gap-3">
            {apps.map((app) => {
              const title = app.jobTitle || app.domain;
              return (
                <li
                  key={app.id}
                  className="flex flex-col rounded-[var(--radius-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="shrink-0 w-10 h-10 rounded-[var(--radius-md)] bg-surface-sunken border border-border flex items-center justify-center text-sm font-semibold text-muted uppercase"
                      aria-hidden
                    >
                      {(app.company || app.domain).slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold leading-snug truncate">
                        <a
                          href={app.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-accent transition-colors inline-flex items-center gap-1.5 max-w-full"
                        >
                          <span className="truncate">{title}</span>
                          <ExternalLink className="w-3.5 h-3.5 shrink-0 text-muted" aria-hidden />
                          <span className="sr-only">(opens job posting in a new tab)</span>
                        </a>
                      </h3>
                      <p className="text-xs text-muted mt-0.5 truncate">
                        {[app.company, app.domain].filter(Boolean).join(" · ")}
                        {formatUpdated(app.updatedAt) && ` · Updated ${formatUpdated(app.updatedAt)}`}
                      </p>
                    </div>
                    {savingId === app.id && <Loader2 className="w-4 h-4 animate-spin text-muted shrink-0" aria-label="Saving" />}
                    <button
                      type="button"
                      onClick={() => handleDelete(app.id)}
                      className="shrink-0 -mr-1.5 -mt-1 w-8 h-8 inline-flex items-center justify-center rounded-full text-muted hover:text-danger hover:bg-danger-soft transition-colors"
                      aria-label={`Remove ${title} from tracker`}
                    >
                      <Trash2 className="w-4 h-4" aria-hidden />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <select
                      aria-label={`Status for ${title}`}
                      className={`${selectClasses} py-2 text-xs font-medium`}
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
                      aria-label={`Resume sent for ${title}`}
                      className={`${selectClasses} py-2 text-xs font-medium`}
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
                    aria-label={`Notes for ${title}`}
                    className={`${inputClasses} mt-2 resize-y`}
                    placeholder="Notes: recruiter, follow-up date, interview prep…"
                    rows={2}
                    defaultValue={app.notes ?? ""}
                    onBlur={(e) => {
                      if (e.target.value !== (app.notes ?? "")) patch(app.id, { notes: e.target.value });
                    }}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {toast && <Toast tone={toast.tone}>{toast.text}</Toast>}
    </div>
  );
}
