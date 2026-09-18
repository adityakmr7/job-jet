import type { Profile } from "@job-jet/shared";

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

/** Downloads a resume's PDF bytes and opens it in a new tab via an object
 *  URL — the resume store is private, so this needs the same Bearer-token
 *  fetch as everything else the extension pulls from the backend; a plain
 *  `chrome.tabs.create({url: blobUrl})` wouldn't carry that header. */
export async function openResumeInNewTab(getToken: () => Promise<string | null>, resumeId: string): Promise<void> {
  const token = await getToken();
  if (!token) throw new Error("Not signed in");

  const res = await fetch(`${SYNC_HOST}/api/resume/${resumeId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Couldn't download the resume (${res.status})`);

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  chrome.tabs.create({ url: objectUrl });
}
