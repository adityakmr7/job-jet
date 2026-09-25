/**
 * Build-time validation of the extension's VITE_* environment.
 *
 * Vite inlines `import.meta.env.VITE_*` into the bundle at build time, so a
 * missing or wrong value doesn't fail loudly — it silently ships an
 * extension that can't sign in or talks to the wrong backend. This runs
 * from vite.config.ts and aborts the build instead.
 *
 * Rules:
 *  - VITE_CLERK_PUBLISHABLE_KEY and VITE_CLERK_SYNC_HOST are required and
 *    must be non-empty in every mode.
 *  - The publishable key must look like a Clerk key (pk_test_/pk_live_).
 *  - The sync host must be an absolute http(s) URL (it's also the backend
 *    API base URL).
 *  - In production mode (`vite build`, the default mode for builds), the
 *    backend must not be localhost/loopback and must use https, and the
 *    Clerk key must be a live key (pk_live_). Set
 *    JOBJET_ALLOW_DEV_CONFIG=true to deliberately build a production-mode
 *    bundle against dev values (e.g. a local smoke test). For day-to-day
 *    local unpacked builds use `npm run build:dev` (development mode).
 */

export const REQUIRED_ENV_VARS = ["VITE_CLERK_PUBLISHABLE_KEY", "VITE_CLERK_SYNC_HOST"] as const;

export const ALLOW_DEV_CONFIG_FLAG = "JOBJET_ALLOW_DEV_CONFIG";

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);

export interface EnvValidationResult {
  errors: string[];
  warnings: string[];
}

/** Clerk publishable keys are `pk_{test|live}_` + base64(`${frontendApi}$`). */
function decodesToFrontendApi(key: string): boolean {
  try {
    const decoded = atob(key.replace(/^pk_(test|live)_/, ""));
    return decoded.endsWith("$") && decoded.length > 1;
  } catch {
    return false;
  }
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

  const key = env.VITE_CLERK_PUBLISHABLE_KEY?.trim() ?? "";
  const syncHost = env.VITE_CLERK_SYNC_HOST?.trim() ?? "";

  if (key && !/^pk_(test|live)_[A-Za-z0-9+/=_-]+$/.test(key)) {
    errors.push(
      "VITE_CLERK_PUBLISHABLE_KEY doesn't look like a Clerk publishable key (expected pk_test_… or pk_live_…)."
    );
  } else if (key && !decodesToFrontendApi(key)) {
    errors.push("VITE_CLERK_PUBLISHABLE_KEY is malformed (its payload doesn't decode to a Clerk Frontend API host).");
  }

  let url: URL | undefined;
  if (syncHost) {
    try {
      url = new URL(syncHost);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        errors.push(`VITE_CLERK_SYNC_HOST must be an http(s) URL, got "${syncHost}".`);
        url = undefined;
      }
    } catch {
      errors.push(`VITE_CLERK_SYNC_HOST must be an absolute URL (e.g. https://jobjet.example.com), got "${syncHost}".`);
    }
  }

  if (mode === "production") {
    const devProblems: string[] = [];
    if (url && LOOPBACK_HOSTNAMES.has(url.hostname)) {
      devProblems.push(`VITE_CLERK_SYNC_HOST points at ${url.host} (a local dev server).`);
    } else if (url && url.protocol !== "https:") {
      devProblems.push("VITE_CLERK_SYNC_HOST must use https:// in production.");
    }
    if (key.startsWith("pk_test_")) {
      devProblems.push("VITE_CLERK_PUBLISHABLE_KEY is a development key (pk_test_…); production needs pk_live_….");
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
