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
