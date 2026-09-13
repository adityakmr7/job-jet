"use client";

import { useRef, useState } from "react";
import type { ResumeContent } from "@job-jet/shared";

type ResumeSummary = {
  id: string;
  fileName: string;
  createdAt: string;
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
    <section className="flex flex-col gap-3 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase opacity-60">Resumes</h2>
        <label className="text-sm text-violet-700 font-medium cursor-pointer">
          {state === "uploading" ? "Uploading & parsing…" : "+ Upload resume"}
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

      {state === "error" && <p className="text-sm text-red-600">{error}</p>}

      {resumes.length === 0 ? (
        <p className="text-sm opacity-60">
          Upload a PDF or DOCX resume — it's parsed into structured data the extension autofills from and tailors new resumes off of.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {resumes.map((r) => (
            <li key={r.id} className="border rounded-lg p-3 text-sm">
              <div className="font-medium">{r.fileName}</div>
              <div className="opacity-60">
                {r.content.experience.length} role{r.content.experience.length === 1 ? "" : "s"} ·{" "}
                {r.content.education.length} school{r.content.education.length === 1 ? "" : "s"} ·{" "}
                {r.content.skills.length} skill{r.content.skills.length === 1 ? "" : "s"} parsed
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
