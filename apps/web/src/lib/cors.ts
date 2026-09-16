/**
 * CORS for endpoints the extension calls cross-origin (chrome-extension://
 * -> the web app's API). Only reflects chrome-extension:// origins — never
 * a wildcard — since responses can carry the user's profile data.
 */
export function corsHeaders(origin: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
  if (origin?.startsWith("chrome-extension://")) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  return headers;
}
