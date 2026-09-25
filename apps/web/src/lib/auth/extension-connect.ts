/**
 * Shared contract for the web -> extension handoff (/extension-connect).
 * The extension keeps its own copy of this shape (apps/extension/src/lib/auth.ts);
 * both sides validate strictly.
 */
export const CONNECT_MESSAGE_TYPE = "jobjet:connect";
export const CONNECT_PROTOCOL_VERSION = 1;

/** The extension generates `state` (32 random bytes, base64url). */
export const STATE_RE = /^[A-Za-z0-9_-]{32,128}$/;

export function isValidConnectState(value: unknown): value is string {
  return typeof value === "string" && STATE_RE.test(value);
}

export interface ConnectMessage {
  type: typeof CONNECT_MESSAGE_TYPE;
  v: typeof CONNECT_PROTOCOL_VERSION;
  state: string;
  token: string;
  expiresAt: string;
  user: { email: string; name: string };
}

export function buildConnectMessage(input: Omit<ConnectMessage, "type" | "v">): ConnectMessage {
  return { type: CONNECT_MESSAGE_TYPE, v: CONNECT_PROTOCOL_VERSION, ...input };
}
