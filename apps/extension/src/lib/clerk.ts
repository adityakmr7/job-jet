/**
 * Extracts the Clerk Frontend API host from a publishable key. Publishable
 * keys are `pk_{test|live}_` + base64(`${frontendApi}$`) — this is the same
 * decoding Clerk's own SDK does internally to know which host to talk to.
 * Used at build time (manifest.config.ts) to compute host_permissions, and
 * could be reused at runtime if needed.
 */
export function frontendApiFromPublishableKey(publishableKey: string): string {
  const base64Part = publishableKey.replace(/^pk_(test|live)_/, "");
  const decoded = atob(base64Part);
  return decoded.replace(/\$$/, "");
}
