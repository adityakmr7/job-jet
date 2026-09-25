import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_STORAGE_KEY,
  beginConnect,
  CONNECT_STATE_KEY,
  CONNECT_STATE_TTL_MS,
  generateState,
  getStoredAuth,
  getToken,
  handleConnectMessage,
  isConnectMessage,
  isTrustedConnectSender,
  signOut,
  verifySession,
  type AuthDeps,
  type StorageAreaLike,
} from "../src/lib/auth";
import { AuthExpiredError, NotConnectedError } from "../src/lib/auth";
import { authedFetch } from "../src/lib/api";

const API = "https://jobjet.example.com";
const EXT_ID = "abcdefghijklmnopabcdefghijklmnop";

function memoryArea(): StorageAreaLike & { data: Record<string, unknown> } {
  const data: Record<string, unknown> = {};
  return {
    data,
    async get(key) {
      return key in data ? { [key]: structuredClone(data[key]) } : {};
    },
    async set(items) {
      Object.assign(data, structuredClone(items));
    },
    async remove(key) {
      delete data[key];
    },
  };
}

let now = 1_800_000_000_000;
let deps: AuthDeps & { local: ReturnType<typeof memoryArea>; session: ReturnType<typeof memoryArea> };

beforeEach(() => {
  now = 1_800_000_000_000;
  deps = { local: memoryArea(), session: memoryArea(), now: () => now, apiBaseUrl: API };
});

const TOKEN = encodeURIComponent("A".repeat(32) + "." + "sig+/=".repeat(8));
const sender = (url = `${API}/extension-connect?ext=${EXT_ID}&state=x`, extra: Partial<chrome.runtime.MessageSender> = {}) =>
  ({ url, origin: new URL(url).origin, tab: { id: 7 } as chrome.tabs.Tab, ...extra }) as chrome.runtime.MessageSender;

async function pendingState() {
  const url = await beginConnect(EXT_ID, deps);
  return new URL(url).searchParams.get("state")!;
}

function message(state: string, overrides: Record<string, unknown> = {}) {
  return {
    type: "jobjet:connect",
    v: 1,
    state,
    token: TOKEN,
    expiresAt: new Date(now + 30 * 86400_000).toISOString(),
    user: { email: "ada@example.com", name: "Ada" },
    ...overrides,
  };
}

describe("connect state", () => {
  it("generates unguessable URL-safe nonces", () => {
    const a = generateState();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateState()).not.toBe(a);
  });

  it("opens the web app's connect page with our id and the nonce", async () => {
    const url = new URL(await beginConnect(EXT_ID, deps));
    expect(url.origin + url.pathname).toBe(`${API}/extension-connect`);
    expect(url.searchParams.get("ext")).toBe(EXT_ID);
    expect(deps.session.data[CONNECT_STATE_KEY]).toMatchObject({ state: url.searchParams.get("state") });
  });
});

describe("sender validation", () => {
  it("accepts only the web app's /extension-connect page", () => {
    expect(isTrustedConnectSender(sender(), API)).toBe(true);
    expect(isTrustedConnectSender(sender(`${API}/dashboard`), API)).toBe(false);
    expect(isTrustedConnectSender(sender("https://evil.example/extension-connect"), API)).toBe(false);
    expect(isTrustedConnectSender(sender("https://jobjet.example.com.evil.example/extension-connect"), API)).toBe(false);
    expect(isTrustedConnectSender(sender("http://jobjet.example.com/extension-connect"), API)).toBe(false);
  });

  it("checks the exact origin including port (localhost dev)", () => {
    expect(isTrustedConnectSender(sender("http://localhost:3001/extension-connect"), "http://localhost:3001")).toBe(true);
    expect(isTrustedConnectSender(sender("http://localhost:4000/extension-connect"), "http://localhost:3001")).toBe(false);
  });

  it("rejects mismatched sender.origin, other extensions, and missing urls", () => {
    expect(isTrustedConnectSender(sender(undefined, { origin: "https://evil.example" }), API)).toBe(false);
    expect(isTrustedConnectSender(sender(undefined, { id: "otherextensionid" }), API)).toBe(false);
    expect(isTrustedConnectSender({} as chrome.runtime.MessageSender, API)).toBe(false);
  });
});

describe("message schema", () => {
  it("accepts the documented shape only", () => {
    const state = generateState();
    expect(isConnectMessage(message(state))).toBe(true);
    expect(isConnectMessage(message(state, { type: "other" }))).toBe(false);
    expect(isConnectMessage(message(state, { v: 2 }))).toBe(false);
    expect(isConnectMessage(message(state, { token: "short" }))).toBe(false);
    expect(isConnectMessage(message(state, { token: "<script>".repeat(10) }))).toBe(false);
    expect(isConnectMessage(message(state, { expiresAt: "soon" }))).toBe(false);
    expect(isConnectMessage(message(state, { user: { email: "no-at", name: "x" } }))).toBe(false);
    expect(isConnectMessage(message(state, { extra: true }))).toBe(false);
    expect(isConnectMessage(message("bad state!"))).toBe(false);
    expect(isConnectMessage(null)).toBe(false);
  });
});

describe("handleConnectMessage", () => {
  it("stores the token when sender, schema and state all check out", async () => {
    const state = await pendingState();
    await expect(handleConnectMessage(message(state), sender(), deps)).resolves.toEqual({ ok: true });
    expect(deps.local.data[AUTH_STORAGE_KEY]).toMatchObject({ token: TOKEN, user: { email: "ada@example.com" } });
    expect(deps.session.data[CONNECT_STATE_KEY]).toBeUndefined(); // consumed
  });

  it("is single-use (replays are rejected)", async () => {
    const state = await pendingState();
    await handleConnectMessage(message(state), sender(), deps);
    await expect(handleConnectMessage(message(state), sender(), deps)).resolves.toEqual({ ok: false, error: "no_pending_connect" });
  });

  it("rejects unsolicited connects and wrong or stale state", async () => {
    await expect(handleConnectMessage(message(generateState()), sender(), deps)).resolves.toMatchObject({ error: "no_pending_connect" });
    await pendingState();
    await expect(handleConnectMessage(message(generateState()), sender(), deps)).resolves.toMatchObject({ error: "state_mismatch" });
    const state = await pendingState();
    now += CONNECT_STATE_TTL_MS + 1;
    await expect(handleConnectMessage(message(state), sender(), deps)).resolves.toMatchObject({ error: "connect_expired" });
    expect(deps.local.data[AUTH_STORAGE_KEY]).toBeUndefined();
  });

  it("rejects untrusted senders before touching storage", async () => {
    const state = await pendingState();
    const res = await handleConnectMessage(message(state), sender("https://evil.example/extension-connect"), deps);
    expect(res).toEqual({ ok: false, error: "untrusted_sender" });
    expect(deps.session.data[CONNECT_STATE_KEY]).toBeDefined(); // not consumed by an attacker
  });

  it("rejects already-expired tokens", async () => {
    const state = await pendingState();
    const res = await handleConnectMessage(message(state, { expiresAt: new Date(now - 1000).toISOString() }), sender(), deps);
    expect(res).toMatchObject({ ok: false, error: "token_expired" });
  });
});

describe("token storage and expiry", () => {
  async function connected(expiresInMs = 60_000) {
    const state = await pendingState();
    await handleConnectMessage(message(state, { expiresAt: new Date(now + expiresInMs).toISOString() }), sender(), deps);
  }

  it("returns the token until it expires, then forgets it", async () => {
    await connected(60_000);
    expect(await getToken(deps)).toBe(TOKEN);
    now += 60_001;
    expect(await getToken(deps)).toBeNull();
    expect(deps.local.data[AUTH_STORAGE_KEY]).toBeUndefined();
  });

  it("discards malformed stored values", async () => {
    deps.local.data[AUTH_STORAGE_KEY] = { token: 42 };
    expect(await getStoredAuth(deps)).toBeNull();
    expect(deps.local.data[AUTH_STORAGE_KEY]).toBeUndefined();
  });

  it("verifySession clears the token when the server rejects it, keeps it when offline", async () => {
    await connected();
    const offline = vi.fn(async () => {
      throw new TypeError("network");
    });
    await expect(verifySession(deps, offline as unknown as typeof fetch)).resolves.toEqual({ status: "offline" });
    expect(await getToken(deps)).toBe(TOKEN);

    const ok = vi.fn(async () => Response.json({ user: { email: "ada@example.com", name: "Ada L" } }));
    await expect(verifySession(deps, ok as unknown as typeof fetch)).resolves.toEqual({ status: "valid", user: { email: "ada@example.com", name: "Ada L" } });
    const [, init] = ok.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);

    const revoked = vi.fn(async () => new Response("", { status: 401 }));
    await expect(verifySession(deps, revoked as unknown as typeof fetch)).resolves.toEqual({ status: "invalid" });
    expect(await getToken(deps)).toBeNull();
  });

  it("signOut revokes the session server-side and always clears locally", async () => {
    await connected();
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("offline");
    });
    await signOut(deps, fetchImpl as unknown as typeof fetch);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${API}/api/auth/sign-out`);
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("omit");
    expect(await getToken(deps)).toBeNull();
  });
});

describe("authedFetch", () => {
  it("sends the bearer token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ ok: true }));
    await authedFetch(async () => "tok", "/api/profile");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer tok");
    expect(init.credentials).toBe("omit");
    fetchMock.mockRestore();
  });

  it("throws NotConnectedError without a token", async () => {
    await expect(authedFetch(async () => null, "/api/profile")).rejects.toBeInstanceOf(NotConnectedError);
  });

  it("clears the token and throws AuthExpiredError on 401", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 401 }));
    const onUnauthorized = vi.fn(async () => {});
    await expect(authedFetch(async () => "tok", "/api/profile", {}, onUnauthorized)).rejects.toBeInstanceOf(AuthExpiredError);
    expect(onUnauthorized).toHaveBeenCalledOnce();
    fetchMock.mockRestore();
  });
});
