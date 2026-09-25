import { API_BASE_URL, apiOrigin } from "./config";

/**
 * Extension authentication (Better Auth bearer token).
 *
 * Flow:
 *  1. Side panel → startConnect(): stores a single-use random `state` in
 *     chrome.storage.session and opens <web app>/extension-connect?ext=<our
 *     id>&state=<state> in a tab.
 *  2. The user (signed in on the web) clicks "Connect". The page mints a
 *     dedicated extension session and calls
 *     chrome.runtime.sendMessage(<our id>, { type: "jobjet:connect", ... }).
 *     Only the web app origin can do this (manifest externally_connectable).
 *  3. background → handleConnectMessage(): accepts it only if the sender is
 *     exactly the web app's /extension-connect page, the message matches the
 *     schema, and `state` matches the pending one (<10 min old, then
 *     consumed). Then stores the token.
 *  4. API calls send `Authorization: Bearer <token>`; a 401 clears the token
 *     and the panel asks the user to reconnect. Sign-out revokes the session
 *     server-side and clears local state.
 *
 * Storage choice: chrome.storage.local, so the connection survives browser
 * restarts (storage.session would force a reconnect on every restart). It's
 * readable only by this extension's own contexts — web pages can't access
 * it — and the token is scoped (separate, revocable session; expiry stored
 * and enforced here and by the server). The one-time `state` lives in
 * chrome.storage.session (memory only, trusted contexts only).
 */

export const AUTH_STORAGE_KEY = "jobjet.auth";
export const CONNECT_STATE_KEY = "jobjet.connectState";
export const CONNECT_STATE_TTL_MS = 10 * 60 * 1000;
export const CONNECT_MESSAGE_TYPE = "jobjet:connect";
export const CONNECT_PATH = "/extension-connect";

export interface AuthUser {
  email: string;
  name: string;
}

export interface StoredAuth {
  token: string;
  expiresAt: number;
  user: AuthUser;
  connectedAt: number;
}

interface PendingConnect {
  state: string;
  createdAt: number;
}

/** Minimal chrome.storage.StorageArea surface (makes this testable). */
export interface StorageAreaLike {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface AuthDeps {
  local: StorageAreaLike;
  session: StorageAreaLike;
  now: () => number;
  apiBaseUrl: string;
}

export function defaultDeps(): AuthDeps {
  return {
    local: chrome.storage.local as unknown as StorageAreaLike,
    session: chrome.storage.session as unknown as StorageAreaLike,
    now: () => Date.now(),
    apiBaseUrl: API_BASE_URL,
  };
}

const STATE_RE = /^[A-Za-z0-9_-]{32,128}$/;
// Signed session token, URL-encoded: "<32 chars>.<base64 HMAC>" → [A-Za-z0-9%._-].
const TOKEN_RE = /^[A-Za-z0-9%._~-]{40,512}$/;

/** 32 random bytes, base64url (43 chars). */
export function generateState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function connectUrl(extensionId: string, state: string, apiBaseUrl: string = API_BASE_URL): string {
  const params = new URLSearchParams({ ext: extensionId, state });
  return `${apiBaseUrl}${CONNECT_PATH}?${params.toString()}`;
}

/** Records a fresh pending state and returns the URL to open. */
export async function beginConnect(extensionId: string, deps: AuthDeps = defaultDeps()): Promise<string> {
  const state = generateState();
  const pending: PendingConnect = { state, createdAt: deps.now() };
  await deps.session.set({ [CONNECT_STATE_KEY]: pending });
  return connectUrl(extensionId, state, deps.apiBaseUrl);
}

export async function startConnect(): Promise<void> {
  const url = await beginConnect(chrome.runtime.id);
  await chrome.tabs.create({ url });
}

export interface ConnectMessage {
  type: typeof CONNECT_MESSAGE_TYPE;
  v: 1;
  state: string;
  token: string;
  expiresAt: string;
  user: AuthUser;
}

/** Strict schema check for the message the web page sends. */
export function isConnectMessage(value: unknown): value is ConnectMessage {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  if (m.type !== CONNECT_MESSAGE_TYPE || m.v !== 1) return false;
  if (typeof m.state !== "string" || !STATE_RE.test(m.state)) return false;
  if (typeof m.token !== "string" || !TOKEN_RE.test(m.token)) return false;
  if (typeof m.expiresAt !== "string" || Number.isNaN(Date.parse(m.expiresAt))) return false;
  const user = m.user as Record<string, unknown> | undefined;
  if (typeof user !== "object" || user === null) return false;
  if (typeof user.email !== "string" || user.email.length > 320 || !user.email.includes("@")) return false;
  if (typeof user.name !== "string" || user.name.length > 200) return false;
  const allowed = new Set(["type", "v", "state", "token", "expiresAt", "user"]);
  return Object.keys(m).every((k) => allowed.has(k));
}

/** Only the web app's own /extension-connect page (exact origin, incl. port). */
export function isTrustedConnectSender(sender: chrome.runtime.MessageSender, apiBaseUrl: string = API_BASE_URL): boolean {
  const expected = apiOrigin(apiBaseUrl);
  if (!expected || !sender.url) return false;
  let url: URL;
  try {
    url = new URL(sender.url);
  } catch {
    return false;
  }
  if (url.origin !== expected || url.pathname !== CONNECT_PATH) return false;
  // sender.origin is set by Chrome for web senders; cross-check when present.
  if (sender.origin !== undefined && sender.origin !== expected) return false;
  // A web page, not another extension.
  if (sender.id !== undefined) return false;
  return true;
}

export type ConnectResult = { ok: true } | { ok: false; error: string };

/** Validates and applies a connect message (background, onMessageExternal). */
export async function handleConnectMessage(
  message: unknown,
  sender: chrome.runtime.MessageSender,
  deps: AuthDeps = defaultDeps()
): Promise<ConnectResult> {
  if (!isTrustedConnectSender(sender, deps.apiBaseUrl)) return { ok: false, error: "untrusted_sender" };
  if (!isConnectMessage(message)) return { ok: false, error: "invalid_message" };

  const stored = (await deps.session.get(CONNECT_STATE_KEY))[CONNECT_STATE_KEY] as PendingConnect | undefined;
  if (!stored || typeof stored.state !== "string") return { ok: false, error: "no_pending_connect" };
  if (deps.now() - stored.createdAt > CONNECT_STATE_TTL_MS) {
    await deps.session.remove(CONNECT_STATE_KEY);
    return { ok: false, error: "connect_expired" };
  }
  if (stored.state !== message.state) return { ok: false, error: "state_mismatch" };

  // Single use.
  await deps.session.remove(CONNECT_STATE_KEY);

  const expiresAt = Date.parse(message.expiresAt);
  if (expiresAt <= deps.now()) return { ok: false, error: "token_expired" };

  const auth: StoredAuth = {
    token: message.token,
    expiresAt,
    user: { email: message.user.email, name: message.user.name },
    connectedAt: deps.now(),
  };
  await deps.local.set({ [AUTH_STORAGE_KEY]: auth });
  return { ok: true };
}

function isStoredAuth(value: unknown): value is StoredAuth {
  if (typeof value !== "object" || value === null) return false;
  const a = value as Record<string, unknown>;
  return typeof a.token === "string" && typeof a.expiresAt === "number" && typeof a.user === "object" && a.user !== null;
}

/** The stored connection, or null if missing, malformed or expired
 *  (expired/malformed entries are removed). */
export async function getStoredAuth(deps: AuthDeps = defaultDeps()): Promise<StoredAuth | null> {
  const value = (await deps.local.get(AUTH_STORAGE_KEY))[AUTH_STORAGE_KEY];
  if (value === undefined) return null;
  if (!isStoredAuth(value) || value.expiresAt <= deps.now()) {
    await deps.local.remove(AUTH_STORAGE_KEY);
    return null;
  }
  return value;
}

export async function getToken(deps: AuthDeps = defaultDeps()): Promise<string | null> {
  return (await getStoredAuth(deps))?.token ?? null;
}

export async function clearAuth(deps: AuthDeps = defaultDeps()): Promise<void> {
  await deps.local.remove(AUTH_STORAGE_KEY);
}

/** Revokes the extension session on the server (best effort) and forgets it locally. */
export async function signOut(deps: AuthDeps = defaultDeps(), fetchImpl: typeof fetch = fetch): Promise<void> {
  const auth = await getStoredAuth(deps);
  try {
    if (auth) {
      await fetchImpl(`${deps.apiBaseUrl}/api/auth/sign-out`, {
        method: "POST",
        credentials: "omit",
        headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
        body: "{}",
      });
    }
  } catch {
    // Offline etc. — the local token is still removed below; the server
    // session expires on its own and can be revoked from Account settings.
  } finally {
    await clearAuth(deps);
  }
}

export type SessionCheck = { status: "valid"; user: AuthUser } | { status: "invalid" } | { status: "offline" };

/** Confirms the token with the server; clears it if the server rejects it. */
export async function verifySession(deps: AuthDeps = defaultDeps(), fetchImpl: typeof fetch = fetch): Promise<SessionCheck> {
  const auth = await getStoredAuth(deps);
  if (!auth) return { status: "invalid" };
  let res: Response;
  try {
    res = await fetchImpl(`${deps.apiBaseUrl}/api/auth/get-session`, {
      credentials: "omit",
      headers: { Authorization: `Bearer ${auth.token}` },
    });
  } catch {
    return { status: "offline" };
  }
  if (res.status === 401 || res.status === 403) {
    await clearAuth(deps);
    return { status: "invalid" };
  }
  if (!res.ok) return { status: "offline" };
  const body = (await res.json().catch(() => null)) as { user?: { email?: string; name?: string } } | null;
  if (!body?.user?.email) {
    await clearAuth(deps);
    return { status: "invalid" };
  }
  return { status: "valid", user: { email: body.user.email, name: body.user.name ?? "" } };
}

/** Thrown by API calls when the server rejects the token (after clearing it). */
export class AuthExpiredError extends Error {
  constructor() {
    super("Your Job Jet session has expired — reconnect to continue.");
    this.name = "AuthExpiredError";
  }
}

export class NotConnectedError extends Error {
  constructor() {
    super("Not connected to Job Jet.");
    this.name = "NotConnectedError";
  }
}
