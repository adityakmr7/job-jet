"use client";

import { useRef, useState } from "react";
import { FileText, Upload, Loader2, Download, Sparkles } from "lucide-react";
import type { ResumeContent } from "@job-jet/shared";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/feedback";
import { buttonClasses } from "@/components/ui/button";

type ResumeSummary = {
  id: string;
  fileName: string;
  createdAt: string;
  kind: "uploaded_original" | "ai_tailored";
  content: ResumeContent;
};

export function ResumeUpload({
  initialResumes,
  onParsed,
}: {
  initialResumes: ResumeSummary[];
  /** Called with the freshly parsed profile-shaped content so the caller
   *  can offer to prefill the profile editor from it. */
  onParsed?: (content: ResumeContent) => void;
}) {
  const [resumes, setResumes] = useState(initialResumes);
  const [state, setState] = useState<"idle" | "uploading" | "error">("idle");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChosen(file: File) {
    setState("uploading");
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/resume", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Upload failed (${res.status})`);
      setResumes((prev) => [body.resume, ...prev]);
      onParsed?.(body.resume.content);
      setState("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setState("error");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      aria-label="Upload a resume (PDF or DOCX)"
      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      className="sr-only"
      disabled={state === "uploading"}
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) handleFileChosen(file);
      }}
    />
  );

  const uploading = state === "uploading";

  return (
    <Card aria-labelledby="resumes-heading" aria-busy={uploading}>
      <CardHeader
        id="resumes-heading"
        icon={<FileText className="w-4 h-4" aria-hidden />}
        title="Resumes"
        description="Your uploads and every tailored version, in one place."
        action={
          resumes.length > 0 ? (
            <label
              className={`${buttonClasses({ variant: "secondary", size: "sm" })} cursor-pointer focus-within:outline-2 focus-within:outline-accent ${
                uploading ? "opacity-60 pointer-events-none" : ""
              }`}
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Upload className="w-3.5 h-3.5" aria-hidden />}
              {uploading ? "Parsing…" : "Upload"}
              {fileInput}
            </label>
          ) : null
        }
      />

      {state === "error" && (
        <Alert tone="error" className="mb-4">
          {error}
        </Alert>
      )}

      {uploading && (
        <Alert tone="loading" className="mb-4">
          Uploading and reading your resume. This usually takes 10–20 seconds.
        </Alert>
      )}

      {resumes.length === 0 ? (
        <label
          className={`group flex flex-col items-center justify-center rounded-[var(--radius-lg)] border-2 border-dashed border-border-strong bg-surface-sunken/50 px-6 py-10 text-center cursor-pointer hover:border-accent hover:bg-accent-soft/40 focus-within:border-accent transition-colors ${
            uploading ? "opacity-60 pointer-events-none" : ""
          }`}
        >
          <span className="w-12 h-12 rounded-2xl bg-accent-soft text-accent flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden /> : <Upload className="w-5 h-5" aria-hidden />}
          </span>
          <span className="font-semibold">Upload your resume</span>
          <span className="mt-1 text-sm text-muted max-w-sm">
            PDF or DOCX, up to 10MB. We&apos;ll turn it into the profile below so you don&apos;t have to type it in.
          </span>
          {fileInput}
        </label>
      ) : (
        <ul className="flex flex-col gap-2">
          {resumes.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface px-3.5 py-3 text-sm hover:border-border-strong transition-colors"
            >
              <div
                className={`shrink-0 w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center ${
                  r.kind === "ai_tailored" ? "bg-flare-soft text-[#b8431a]" : "bg-accent-soft text-accent"
                }`}
              >
                {r.kind === "ai_tailored" ? <Sparkles className="w-4 h-4" aria-hidden /> : <FileText className="w-4 h-4" aria-hidden />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium truncate">{r.fileName}</span>
                  {r.kind === "ai_tailored" && <Badge tone="flare">Tailored</Badge>}
                </div>
                <div className="text-muted text-xs mt-0.5">
                  {formatDate(r.createdAt)} · {r.content.experience.length} role{r.content.experience.length === 1 ? "" : "s"} ·{" "}
                  {r.content.skills.length} skill{r.content.skills.length === 1 ? "" : "s"}
                </div>
              </div>
              <a
                href={`/api/resume/${r.id}/download`}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full h-8 px-3 text-xs font-semibold text-accent hover:bg-accent-soft transition-colors"
                aria-label={`Download ${r.fileName}`}
              >
                <Download className="w-3.5 h-3.5" aria-hidden /> <span className="hidden sm:inline">Download</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}
