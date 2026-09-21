import type { DetectedField, Profile } from "@job-jet/shared";

const SYNC_HOST = import.meta.env.VITE_CLERK_SYNC_HOST;

/** Fetches the signed-in user's saved profile from the web app's API.
 *  Cross-origin (chrome-extension:// -> the web app's origin) — the
 *  session token is passed as a Bearer header since there's no shared
 *  cookie jar between the two origins; see src/lib/cors.ts on the backend. */
export async function fetchProfile(getToken: () => Promise<string | null>): Promise<Profile | null> {
  const token = await getToken();
  if (!token) throw new Error("Not signed in");

  const res = await fetch(`${SYNC_HOST}/api/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
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
  getToken: () => Promise<string | null>,
  jobDescription: string
): Promise<ResumeRecord> {
  const token = await getToken();
  if (!token) throw new Error("Not signed in");

  const res = await fetch(`${SYNC_HOST}/api/resume/tailor`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
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
  getToken: () => Promise<string | null>,
  resumeId: string,
  fileName: string
): Promise<void> {
  const token = await getToken();
  if (!token) throw new Error("Not signed in");

  const res = await fetch(`${SYNC_HOST}/api/resume/${resumeId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Couldn't download the resume (${res.status})`);

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  // saveAs: false — goes straight to the default Downloads folder with
  // no extra prompt, since the point is to have the file immediately
  // ready to pick in the form's own file dialog, not to make the user
  // choose a location for a file they're about to re-select anyway.
  await chrome.downloads.download({ url: objectUrl, filename: fileName, saveAs: false });
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
  getToken: () => Promise<string | null>,
  domain: string,
  fields: DetectedField[]
): Promise<{ selector: string; value: string }[]> {
  try {
    const token = await getToken();
    if (!token) return [];

    const res = await fetch(`${SYNC_HOST}/api/autofill/map`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
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
  getToken: () => Promise<string | null>,
  data: ApplicationUpsert
): Promise<void> {
  const token = await getToken();
  if (!token) return; // best-effort — never block the actual feature on this
  await fetch(`${SYNC_HOST}/api/applications`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).catch(() => {});
}
