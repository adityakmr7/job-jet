/**
 * Hosts that belong to Job Jet's own web app (dashboard, sign-in, landing
 * page). The dashboard genuinely has real form fields and a file upload
 * (profile editor + resume uploader) — enough "form evidence" to otherwise
 * pass the job-page heuristic — so the content script must never offer
 * autofill there.
 *
 * Derived from the configured backend URL (VITE_API_BASE_URL — the same
 * origin the extension talks to for its API and sign-in), so a
 * production build automatically excludes the production domain and a dev
 * build excludes the local dev server, with no hardcoded hosts to forget.
 *
 * Matched by host (hostname:port), not just hostname: localhost also serves
 * the detection test fixtures (port 4000), which must NOT be excluded.
 */

const LOOPBACK_HOSTNAMES = ["localhost", "127.0.0.1"];

/** Returns the list of `host` strings (hostname[:port]) to treat as Job
 *  Jet's own app, given the configured backend URL. Invalid/empty input
 *  yields an empty list rather than throwing — the build already refuses
 *  to produce an extension without a valid URL (see env.config.ts). */
export function ownAppHosts(backendUrl: string | undefined): string[] {
  if (!backendUrl) return [];
  let url: URL;
  try {
    url = new URL(backendUrl);
  } catch {
    return [];
  }

  const hosts = new Set<string>([url.host.toLowerCase()]);
  const hostname = url.hostname.toLowerCase();
  const portSuffix = url.port ? `:${url.port}` : "";

  // localhost <-> 127.0.0.1 are the same dev server.
  if (LOOPBACK_HOSTNAMES.includes(hostname)) {
    for (const h of LOOPBACK_HOSTNAMES) hosts.add(`${h}${portSuffix}`);
  } else if (hostname.startsWith("www.")) {
    hosts.add(`${hostname.slice(4)}${portSuffix}`);
  } else {
    hosts.add(`www.${hostname}${portSuffix}`);
  }

  return [...hosts];
}

export function isOwnAppHost(host: string, backendUrl: string | undefined): boolean {
  return ownAppHosts(backendUrl).includes(host.toLowerCase());
}
