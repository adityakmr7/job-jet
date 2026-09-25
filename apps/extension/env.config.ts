/**
 * Build-time validation of the extension's VITE_* environment.
 *
 * Vite inlines `import.meta.env.VITE_*` into the bundle at build time, so a
 * missing or wrong value doesn't fail loudly — it silently ships an
 * extension that talks to the wrong backend. This runs from vite.config.ts
 * and aborts the build instead.
 *
 * Rules:
 *  - VITE_API_BASE_URL (the Job Jet web app origin: API, sign-in and the
 *    /extension-connect page) is required and must be an absolute http(s)
 *    URL with no path.
 *  - In production mode (`vite build`, the default mode for builds), it must
 *    not be localhost/loopback and must use https — this also guarantees
 *    the manifest's externally_connectable never lists localhost in a
 *    release. Set JOBJET_ALLOW_DEV_CONFIG=true to deliberately build a
 *    production-mode bundle against dev values (e.g. a local smoke test).
 *    For day-to-day local unpacked builds use `npm run build:dev`.
 *  - Leftover Clerk variables (VITE_CLERK_*) only produce a warning.
 */

export const REQUIRED_ENV_VARS = ["VITE_API_BASE_URL"] as const;

export const ALLOW_DEV_CONFIG_FLAG = "JOBJET_ALLOW_DEV_CONFIG";

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);

export interface EnvValidationResult {
  errors: string[];
  warnings: string[];
}

function isTruthyFlag(value: string | undefined): boolean {
  return value !== undefined && ["1", "true", "yes"].includes(value.trim().toLowerCase());
}

export function validateExtensionEnv(env: Record<string, string | undefined>, mode: string): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const name of REQUIRED_ENV_VARS) {
    if (!env[name]?.trim()) errors.push(`${name} is missing or empty.`);
  }

  for (const legacy of ["VITE_CLERK_PUBLISHABLE_KEY", "VITE_CLERK_SYNC_HOST"]) {
    if (env[legacy]?.trim()) warnings.push(`${legacy} is no longer used (Clerk was replaced by Better Auth) — remove it.`);
  }

  const baseUrl = env.VITE_API_BASE_URL?.trim() ?? "";
  let url: URL | undefined;
  if (baseUrl) {
    try {
      url = new URL(baseUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        errors.push(`VITE_API_BASE_URL must be an http(s) URL, got "${baseUrl}".`);
        url = undefined;
      } else if ((url.pathname !== "/" && url.pathname !== "") || url.search || url.hash) {
        errors.push(`VITE_API_BASE_URL must be an origin with no path (e.g. https://jobjet.example.com), got "${baseUrl}".`);
      }
    } catch {
      errors.push(`VITE_API_BASE_URL must be an absolute URL (e.g. https://jobjet.example.com), got "${baseUrl}".`);
    }
  }

  if (mode === "production") {
    const devProblems: string[] = [];
    if (url && LOOPBACK_HOSTNAMES.has(url.hostname)) {
      devProblems.push(`VITE_API_BASE_URL points at ${url.host} (a local dev server).`);
    } else if (url && url.protocol !== "https:") {
      devProblems.push("VITE_API_BASE_URL must use https:// in production.");
    }

    if (devProblems.length) {
      if (isTruthyFlag(env[ALLOW_DEV_CONFIG_FLAG])) {
        warnings.push(...devProblems.map((p) => `${p} (allowed by ${ALLOW_DEV_CONFIG_FLAG})`));
      } else {
        errors.push(...devProblems);
        errors.push(
          `This is a production build. Put production values in apps/extension/.env.production, ` +
            `use \`npm run build:dev\` for a local build, or set ${ALLOW_DEV_CONFIG_FLAG}=true to override.`
        );
      }
    }
  }

  return { errors, warnings };
}

/** Throws a single readable error listing every problem, or returns warnings. */
export function assertExtensionEnv(env: Record<string, string | undefined>, mode: string): string[] {
  const { errors, warnings } = validateExtensionEnv(env, mode);
  if (errors.length) {
    throw new Error(
      `\n[job-jet] Invalid extension environment for mode "${mode}":\n` +
        errors.map((e) => `  - ${e}`).join("\n") +
        `\nSee apps/extension/.env.example.\n`
    );
  }
  return warnings;
}

/**
 * Chrome match pattern for `externally_connectable`: only the web app's
 * origin may message the extension (used by /extension-connect). Match
 * patterns can't carry a port, so a localhost dev origin becomes
 * `http://localhost/*`; the background script still checks the exact
 * origin (including port) of every message.
 */
export function externallyConnectableMatch(baseUrl: string): string {
  const url = new URL(baseUrl);
  return `${url.protocol}//${url.hostname}/*`;
}
