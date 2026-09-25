/**
 * Server-side environment access with clear failure messages.
 *
 * Deliberately lazy (read at call time, not module load): `next build`
 * imports route modules without production secrets present, so validating
 * eagerly at import would break builds/CI. Every required variable is
 * documented in apps/web/.env.example.
 */

export type EnvSource = Record<string, string | undefined>;

export const REQUIRED_SERVER_ENV = [
  "DATABASE_URL",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "BLOB_READ_WRITE_TOKEN",
] as const;

export type RequiredServerEnv = (typeof REQUIRED_SERVER_ENV)[number];

/** Returns the value of a required env var or throws a descriptive error. */
export function requireEnv(name: RequiredServerEnv, env: EnvSource = process.env): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set. See apps/web/.env.example for every required variable.`);
  }
  return value;
}

/** Names of required variables that are missing/empty (for diagnostics). */
export function missingServerEnv(env: EnvSource = process.env): RequiredServerEnv[] {
  return REQUIRED_SERVER_ENV.filter((name) => !env[name]?.trim());
}

/** Parses a comma/whitespace-separated list env var into trimmed, non-empty entries. */
export function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[\s,]+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Reads an optional env var, returning undefined for unset/blank values. */
export function optionalEnv(name: string, env: EnvSource = process.env): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

/** Google sign-in is enabled only when both OAuth credentials are set. */
export function isGoogleAuthConfigured(env: EnvSource = process.env): boolean {
  return Boolean(optionalEnv("GOOGLE_CLIENT_ID", env) && optionalEnv("GOOGLE_CLIENT_SECRET", env));
}

/** A real email provider (Resend) is configured — required for email
 *  verification to be enforced and for password-reset mail in production. */
export function isEmailProviderConfigured(env: EnvSource = process.env): boolean {
  return Boolean(optionalEnv("RESEND_API_KEY", env));
}
