import type { DetectedField, Profile } from "@job-jet/shared";
import { safeDownloadFilename } from "./download-name";
import { API_BASE_URL } from "./config";
import { AuthExpiredError, clearAuth, NotConnectedError } from "./auth";

const SYNC_HOST = API_BASE_URL;

type TokenGetter = () => Promise<string | null>;

/**
 * fetch() against the Job Jet API with the extension's bearer token. A 401
 * means the session was revoked or expired server-side: the stored token is
 * cleared (the side panel reacts via chrome.storage.onChanged and shows
 * "Reconnect") and AuthExpiredError is thrown.
 */
export async function authedFetch(
  getToken: TokenGetter,
  path: string,
  init: RequestInit = {},
  onUnauthorized: () => Promise<void> = () => clearAuth()
): Promise<Response> {
  const token = await getToken();
  if (!token) throw new NotConnectedError();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${SYNC_HOST}${path}`, { ...init, headers, credentials: "omit" });
  if (res.status === 401) {
    await onUnauthorized();
    throw new AuthExpiredError();
  }
  return res;
}

/** Fetches the signed-in user's saved profile from the web app's API.
 *  Cross-origin (chrome-extension:// -> the web app's origin) — the
 *  session token is passed as a Bearer header since there's no shared
 *  cookie jar between the two origins; see src/lib/auth.ts here and
 *  src/lib/auth/origins.ts on the backend. */
export async function fetchProfile(getToken: TokenGetter): Promise<Profile | null> {
  const res = await authedFetch(getToken, "/api/profile");
  if (!res.ok) throw new Error(`Couldn't load your profile (${res.status})`);

  const body = await res.json();
  return body.profile;
}

type ResumeRecord = { id: string; fileName: string };

/** Generates a resume tailored to `jobDescription` from the user's saved
 *  profile and returns the new resume's record (including its id, used to
 *  download the actual PDF next — the tailor endpoint doesn't return the
 *  file bytes directly). */
export async function tailorResume(
  getToken: TokenGetter,
  jobDescription: string
): Promise<ResumeRecord> {
  const res = await authedFetch(getToken, "/api/resume/tailor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobDescription }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Couldn't generate a resume (${res.status})`);
  return body.resume;
}

/** Downloads a resume's PDF bytes and saves it straight to disk via
 *  chrome.downloads — the resume store is private, so this needs the
 *  same Bearer-token fetch as everything else the extension pulls from
 *  the backend; a plain `chrome.downloads.download({url: backendUrl})`
 *  wouldn't carry that header, hence fetching the bytes here first and
 *  downloading the resulting object URL instead.
 *
 *  Deliberately a real download (chrome.downloads), not just opening
 *  the PDF in a new tab: opening it only lets the user *view* it —
 *  actually getting the file onto disk, ready to pick in the ATS
 *  form's own file-upload dialog, needs a real save. Chrome's own PDF
 *  viewer does have a download button, but relying on the user to find
 *  and click it themselves is an unnecessary extra step for something
 *  they came here specifically to attach to a form. */
export async function downloadResume(
  getToken: TokenGetter,
  resumeId: string,
  fileName: string
): Promise<void> {
  const res = await authedFetch(getToken, `/api/resume/${encodeURIComponent(resumeId)}/download`);
  if (!res.ok) throw new Error(`Couldn't download the resume (${res.status})`);

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  // saveAs: false — goes straight to the default Downloads folder with
  // no extra prompt, since the point is to have the file immediately
  // ready to pick in the form's own file dialog, not to make the user
  // choose a location for a file they're about to re-select anyway.
  try {
    await chrome.downloads.download({ url: objectUrl, filename: safeDownloadFilename(fileName), saveAs: false });
  } finally {
    // Chrome has read the blob once download() resolves; free it shortly after.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }
}

export type ResumeSummary = { id: string; fileName: string; kind?: string; createdAt?: string };

/** The signed-in user's resumes, newest first (GET /api/resume). */
export async function listResumes(getToken: TokenGetter): Promise<ResumeSummary[]> {
  const res = await authedFetch(getToken, "/api/resume");
  if (!res.ok) throw new Error(`Couldn't list your resumes (${res.status})`);
  const body = await res.json().catch(() => ({}));
  return Array.isArray(body.resumes) ? body.resumes : [];
}

const MAX_ATTACH_BYTES = 10 * 1024 * 1024;

/** A resume's bytes as base64, for attaching to an application form's file
 *  input (chrome.scripting args must be JSON-serializable). */
export async function fetchResumeFile(
  getToken: TokenGetter,
  resume: ResumeSummary
): Promise<{ name: string; type: string; base64: string }> {
  const res = await authedFetch(getToken, `/api/resume/${encodeURIComponent(resume.id)}/download`);
  if (!res.ok) throw new Error(`Couldn't download the resume (${res.status})`);
  const blob = await res.blob();
  if (blob.size === 0 || blob.size > MAX_ATTACH_BYTES) throw new Error("Resume file is empty or too large to attach");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  // Keep the real extension (an uploaded original may be .docx); only strip
  // characters no file name should carry.
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  const name = resume.fileName.replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, "-").slice(0, 150).trim() || "resume.pdf";
  return { name, type: blob.type || "application/pdf", base64: btoa(binary) };
}

/** Tier 3 of the autofill engine — for fields the heuristic + adapter
 *  tiers (autofill-map.ts, entirely client-side) didn't recognize, asks
 *  the backend to match them against a fixed set of known profile
 *  attributes via an LLM call, backed by a crowdsourced per-domain cache
 *  so repeat wording only ever hits the model once. Best-effort: returns
 *  an empty array rather than throwing on any failure (rate limit, no
 *  profile yet, network hiccup) — this tier supplements tiers 1/2, it
 *  should never be able to make Autofill itself fail. */
export async function mapFieldsWithLLM(
  getToken: TokenGetter,
  domain: string,
  fields: DetectedField[]
): Promise<{ selector: string; value: string }[]> {
  try {
    const res = await authedFetch(getToken, "/api/autofill/map", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, fields }),
    });
    if (!res.ok) return [];

    const body = await res.json().catch(() => ({}));
    return Array.isArray(body.mappings) ? body.mappings : [];
  } catch {
    return [];
  }
}

type ApplicationUpsert = {
  url: string;
  jobTitle?: string;
  jobDescription?: string;
  resumeId?: string;
  status?: "draft";
};

/** Upserts an application tracker entry for `url` (by user+url, server
 *  side) — called on meaningful engagement (autofilling, generating a
 *  tailored resume), not on every page visit, so the tracker reflects
 *  applications actually worked on rather than every job page glanced at. */
export async function upsertApplication(
  getToken: TokenGetter,
  data: ApplicationUpsert
): Promise<void> {
  // Best-effort — never block the actual feature on this.
  await authedFetch(getToken, "/api/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).catch(() => {});
}
