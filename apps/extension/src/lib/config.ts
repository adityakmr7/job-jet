/** The Job Jet web app origin (API, sign-in, /extension-connect), inlined at
 *  build time and validated by env.config.ts. */
export const API_BASE_URL: string = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export function apiOrigin(baseUrl: string = API_BASE_URL): string {
  try {
    return new URL(baseUrl).origin;
  } catch {
    return "";
  }
}
