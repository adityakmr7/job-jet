"use client";

import { useRef, useState } from "react";
import { FileText, Upload, Loader2, Download, Sparkles } from "lucide-react";
import type { ResumeContent } from "@job-jet/shared";

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

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Resumes</h2>
        <label
          className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors cursor-pointer ${
            state === "uploading" ? "text-muted pointer-events-none" : "text-accent hover:text-accent-hover"
          }`}
        >
          {state === "uploading" ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading &amp; parsing…
            </>
          ) : (
            <>
              <Upload className="w-3.5 h-3.5" /> Upload resume
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            disabled={state === "uploading"}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileChosen(file);
            }}
          />
        </label>
      </div>

      {state === "error" && <p className="text-sm text-red-500 mb-3">{error}</p>}

      {resumes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-strong p-6 text-center">
          <FileText className="w-6 h-6 text-muted mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-sm text-muted max-w-sm mx-auto">
            Upload a PDF or DOCX resume — it&apos;s parsed into structured data the extension autofills from
            and tailors new resumes off of.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {resumes.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-background p-3.5 text-sm"
            >
              <div className="shrink-0 w-9 h-9 rounded-lg bg-accent-soft flex items-center justify-center">
                {r.kind === "ai_tailored" ? (
                  <Sparkles className="w-4 h-4 text-accent" strokeWidth={2} />
                ) : (
                  <FileText className="w-4 h-4 text-accent" strokeWidth={2} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{r.fileName}</span>
                  {r.kind === "ai_tailored" && (
                    <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide rounded-full bg-accent-soft text-accent px-1.5 py-0.5">
                      AI-tailored
                    </span>
                  )}
                </div>
                <div className="text-muted text-xs mt-0.5">
                  {r.content.experience.length} role{r.content.experience.length === 1 ? "" : "s"} ·{" "}
                  {r.content.education.length} school{r.content.education.length === 1 ? "" : "s"} ·{" "}
                  {r.content.skills.length} skill{r.content.skills.length === 1 ? "" : "s"} parsed
                </div>
              </div>
              <a
                href={`/api/resume/${r.id}/download`}
                className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
