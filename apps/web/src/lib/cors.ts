import { parseList, type EnvSource } from "./env";

/**
 * CORS for endpoints the extension calls cross-origin (chrome-extension://
 * -> the web app's API). Never a wildcard — responses carry the user's
 * profile data.
 *
 * Pinned to the extension IDs listed in ALLOWED_EXTENSION_IDS
 * (comma-separated; find an ID on chrome://extensions, and include both
 * the Chrome Web Store ID and any unpacked dev ID you use). When the list
 * is empty:
 *  - in development, any chrome-extension:// origin is allowed, so a fresh
 *    unpacked build works without extra setup;
 *  - in production, no extension origin is allowed (fail closed).
 *
 * CORS is defense in depth here — every API route still requires a valid
 * session, and bearer tokens are only honoured from these same extension
 * origins (see src/lib/auth/origins.ts).
 */

const EXTENSION_ORIGIN_RE = /^chrome-extension:\/\/([a-p]{32})$/;

export interface CorsConfig {
  allowedExtensionIds: string[];
  isProduction: boolean;
}

export function corsConfigFromEnv(env: EnvSource = process.env): CorsConfig {
  return {
    allowedExtensionIds: parseList(env.ALLOWED_EXTENSION_IDS),
    isProduction: env.NODE_ENV === "production",
  };
}

let warnedMissingIds = false;

export function isAllowedExtensionOrigin(origin: string | null, config: CorsConfig): boolean {
  if (!origin) return false;
  const match = EXTENSION_ORIGIN_RE.exec(origin);
  if (!match) return false;
  const id = match[1];
  if (config.allowedExtensionIds.length > 0) return config.allowedExtensionIds.includes(id);
  if (config.isProduction && !warnedMissingIds) {
    warnedMissingIds = true;
    console.warn("[cors] ALLOWED_EXTENSION_IDS is not set — rejecting all extension origins in production.");
  }
  return !config.isProduction;
}

export function corsHeaders(origin: string | null, config: CorsConfig = corsConfigFromEnv()): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, PUT, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    Vary: "Origin",
  };
  if (isAllowedExtensionOrigin(origin, config)) {
    headers["Access-Control-Allow-Origin"] = origin!;
  }
  return headers;
}
