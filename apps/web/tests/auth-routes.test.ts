/**
 * End-to-end-ish auth tests: real Better Auth (email+password, bearer,
 * extension-connect plugin) and the real API route handlers, against an
 * in-process Postgres (PGlite) with the real migrations. Covers: 401 without
 * a session, cookie vs bearer auth, bearer never from web origins and bound
 * to the extension that minted it, per-user ownership (no IDOR), sign-out revocation, and account
 * deletion cascading to data + Blob files.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { createTestDb } from "./helpers/test-db";

const EXT_ID = "abcdefghijklmnopabcdefghijklmnop";
const OTHER_EXT_ID = "ponmlkjihgfedcbaponmlkjihgfedcba";
const SECOND_EXT_ID = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"; // allowlisted too
const APP = "http://localhost:3001";
const EXT_ORIGIN = `chrome-extension://${EXT_ID}`;

vi.hoisted(() => {
  process.env.BETTER_AUTH_SECRET = "test-secret-0123456789-abcdefghijklmnopqrstuvwxyz";
  process.env.BETTER_AUTH_URL = "http://localhost:3001";
  process.env.ALLOWED_EXTENSION_IDS = "abcdefghijklmnopabcdefghijklmnop,bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  process.env.DATABASE_URL = "postgres://unused";
});

const testDb = vi.hoisted(() => ({ current: null as Awaited<ReturnType<typeof createTestDb>> | null }));
vi.mock("@/db", () => ({
  getDb: () => {
    if (!testDb.current) throw new Error("test db not ready");
    return testDb.current.db;
  },
  isLocalDatabaseUrl: () => false,
}));

const blob = vi.hoisted(() => ({ del: vi.fn(async () => {}), get: vi.fn() }));
vi.mock("@vercel/blob", () => ({ del: blob.del, get: blob.get, put: vi.fn() }));

// Imported after mocks.
const authRoute = await import("@/app/api/auth/[...all]/route");
const profileRoute = await import("@/app/api/profile/route");
const applicationsRoute = await import("@/app/api/applications/route");
const applicationRoute = await import("@/app/api/applications/[id]/route");
const downloadRoute = await import("@/app/api/resume/[id]/download/route");
const { createTestDb: makeDb } = await import("./helpers/test-db");
const schema = await import("@/db/schema");

let ip = 1;
function authRequest(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  return new Request(`${APP}/api/auth${path}`, {
    method: init.method ?? "POST",
    headers: {
      "content-type": "application/json",
      origin: APP,
      "x-real-ip": `10.0.0.${ip++}`,
      ...init.headers,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

function cookieFrom(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

async function signUp(email: string) {
  const res = await authRoute.POST(authRequest("/sign-up/email", { body: { email, password: "correct-horse-battery", name: "Test" } }));
  expect(res.status).toBe(200);
  const body = await res.json();
  return { cookie: cookieFrom(res), userId: body.user.id as string };
}

async function extensionToken(cookie: string, extensionId = EXT_ID) {
  return authRoute.POST(authRequest("/extension/token", { body: { extensionId }, headers: { cookie } }));
}

const api = (path: string, init: RequestInit = {}) => new Request(`${APP}${path}`, init);
const bearer = (token: string, origin = EXT_ORIGIN) => ({ authorization: `Bearer ${token}`, origin });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

let alice: { cookie: string; userId: string; token: string };
let bob: { cookie: string; userId: string; token: string };

beforeAll(async () => {
  testDb.current = await makeDb();
  const a = await signUp("alice@example.com");
  const b = await signUp("bob@example.com");
  const ta = await (await extensionToken(a.cookie)).json();
  const tb = await (await extensionToken(b.cookie)).json();
  alice = { ...a, token: ta.token };
  bob = { ...b, token: tb.token };
}, 60_000);

afterAll(async () => {
  await testDb.current?.client.close();
});

describe("unauthenticated requests", () => {
  it("get 401 JSON from every protected route", async () => {
    const id = "00000000-0000-4000-8000-000000000000";
    const responses = await Promise.all([
      profileRoute.GET(api("/api/profile")),
      applicationsRoute.GET(api("/api/applications")),
      applicationsRoute.POST(api("/api/applications", { method: "POST", body: "{}" })),
      applicationRoute.PATCH(api(`/api/applications/${id}`, { method: "PATCH", body: "{}" }), ctx(id)),
      applicationRoute.DELETE(api(`/api/applications/${id}`, { method: "DELETE" }), ctx(id)),
      downloadRoute.GET(api(`/api/resume/${id}/download`), ctx(id)),
    ]);
    for (const res of responses) {
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized" });
    }
  });

  it("reject forged or unsigned bearer tokens", async () => {
    const raw = decodeURIComponent(alice.token).split(".")[0];
    for (const token of ["not-a-token", raw, `${raw}.forged-signature`]) {
      const res = await profileRoute.GET(api("/api/profile", { headers: bearer(token) }));
      expect(res.status).toBe(401);
    }
  });
});

describe("session types", () => {
  it("accepts the web session cookie", async () => {
    const res = await profileRoute.GET(api("/api/profile", { headers: { cookie: alice.cookie } }));
    expect(res.status).toBe(200);
  });

  it("accepts an extension bearer token from the allowed extension origin", async () => {
    const res = await profileRoute.GET(api("/api/profile", { headers: bearer(alice.token) }));
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(EXT_ORIGIN);
  });

  it("accepts the extension token without an Origin (Chrome omits it on extension GETs)", async () => {
    const res = await profileRoute.GET(api("/api/profile", { headers: { authorization: `Bearer ${alice.token}` } }));
    expect(res.status).toBe(200);
  });

  it("ignores bearer tokens from web origins and from other extensions", async () => {
    for (const origin of ["https://evil.example", APP, `chrome-extension://${OTHER_EXT_ID}`, `chrome-extension://${SECOND_EXT_ID}`]) {
      const res = await profileRoute.GET(api("/api/profile", { headers: bearer(alice.token, origin) }));
      expect(res.status).toBe(401);
    }
  });

  it("won't accept a web session cookie replayed as a bearer token", async () => {
    const cookieToken = decodeURIComponent(alice.cookie.split("=").slice(1).join("="));
    for (const headers of [bearer(cookieToken), { authorization: `Bearer ${cookieToken}` }]) {
      const res = await profileRoute.GET(api("/api/profile", { headers }));
      expect(res.status).toBe(401);
    }
  });

  it("blocks cookie-authenticated mutations from a foreign web origin", async () => {
    const res = await profileRoute.PUT(
      api("/api/profile", { method: "PUT", headers: { cookie: alice.cookie, origin: "https://evil.example" }, body: "{}" })
    );
    expect(res.status).toBe(403);
  });
});

describe("extension token endpoint", () => {
  it("returns a signed token and an expiry", async () => {
    const res = await extensionToken(alice.cookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(decodeURIComponent(body.token)).toMatch(/^[A-Za-z0-9]{32}\.[A-Za-z0-9+/=]+$/);
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    alice.token = body.token; // previous extension session was replaced
  });

  it("replaces the previous session for the same extension", async () => {
    const first = (await (await extensionToken(bob.cookie)).json()).token;
    const second = (await (await extensionToken(bob.cookie)).json()).token;
    expect((await profileRoute.GET(api("/api/profile", { headers: bearer(first) }))).status).toBe(401);
    expect((await profileRoute.GET(api("/api/profile", { headers: bearer(second) }))).status).toBe(200);
    bob.token = second;
  });

  it("refuses extension IDs that aren't allowlisted", async () => {
    expect((await extensionToken(alice.cookie, OTHER_EXT_ID)).status).toBe(403);
    expect((await extensionToken(alice.cookie, "not-an-id")).status).toBe(403);
  });

  it("requires a web session — a bearer token can't mint more tokens", async () => {
    expect((await extensionToken("")).status).toBe(401);
    const res = await authRoute.POST(
      authRequest("/extension/token", { body: { extensionId: EXT_ID }, headers: bearer(alice.token) })
    );
    expect(res.status).toBe(403);
  });

  it("is protected by Better Auth's origin check", async () => {
    const res = await authRoute.POST(
      authRequest("/extension/token", { body: { extensionId: EXT_ID }, headers: { cookie: alice.cookie, origin: "https://evil.example" } })
    );
    expect(res.status).toBe(403);
  });
});

describe("ownership (no IDOR)", () => {
  let aliceAppId: string;
  let aliceResumeId: string;

  beforeAll(async () => {
    const res = await applicationsRoute.POST(
      api("/api/applications", {
        method: "POST",
        headers: { ...bearer(alice.token), "content-type": "application/json" },
        body: JSON.stringify({ url: "https://jobs.example.com/42", jobTitle: "Engineer" }),
      })
    );
    expect(res.status).toBe(200);
    aliceAppId = (await res.json()).application.id;
    const [resume] = await testDb
      .current!.db.insert(schema.resumes)
      .values({
        userId: alice.userId,
        kind: "uploaded_original",
        fileName: "alice.pdf",
        blobUrl: "https://blob.example/resumes/alice.pdf",
        content: { summary: "", experience: [], education: [], skills: [] } as never,
      })
      .returning();
    aliceResumeId = resume.id;
  });

  it("lists only the caller's own applications", async () => {
    const res = await applicationsRoute.GET(api("/api/applications", { headers: bearer(bob.token) }));
    expect((await res.json()).applications).toEqual([]);
  });

  it("returns 404 when another user updates, deletes or downloads", async () => {
    const patch = await applicationRoute.PATCH(
      api(`/api/applications/${aliceAppId}`, { method: "PATCH", headers: bearer(bob.token), body: JSON.stringify({ status: "applied" }) }),
      ctx(aliceAppId)
    );
    expect(patch.status).toBe(404);
    const del = await applicationRoute.DELETE(api(`/api/applications/${aliceAppId}`, { method: "DELETE", headers: bearer(bob.token) }), ctx(aliceAppId));
    expect(del.status).toBe(404);
    const dl = await downloadRoute.GET(api(`/api/resume/${aliceResumeId}/download`, { headers: bearer(bob.token) }), ctx(aliceResumeId));
    expect(dl.status).toBe(404);
    expect(blob.get).not.toHaveBeenCalled();
  });

  it("won't attach someone else's resume", async () => {
    const res = await applicationsRoute.POST(
      api("/api/applications", {
        method: "POST",
        headers: bearer(bob.token),
        body: JSON.stringify({ url: "https://jobs.example.com/7", resumeId: aliceResumeId }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("still lets the owner update their application", async () => {
    const res = await applicationRoute.PATCH(
      api(`/api/applications/${aliceAppId}`, { method: "PATCH", headers: bearer(alice.token), body: JSON.stringify({ status: "applied" }) }),
      ctx(aliceAppId)
    );
    expect(res.status).toBe(200);
    expect((await res.json()).application.status).toBe("applied");
  });
});

describe("sign-out and account deletion", () => {
  it("signing out with the extension token revokes it", async () => {
    const token = (await (await extensionToken(bob.cookie)).json()).token;
    // Chrome may attach the web cookie to extension fetches; it must be ignored
    // and the response must not touch the browser's (web) cookies.
    const out = await authRoute.POST(
      authRequest("/sign-out", { body: {}, headers: { ...bearer(token), cookie: bob.cookie } }),
    );
    expect(out.status).toBe(200);
    expect(out.headers.get("access-control-allow-origin")).toBe(EXT_ORIGIN);
    expect(out.headers.getSetCookie()).toEqual([]);
    expect((await profileRoute.GET(api("/api/profile", { headers: bearer(token) }))).status).toBe(401);
    // The web session is separate and still valid.
    expect((await profileRoute.GET(api("/api/profile", { headers: { cookie: bob.cookie } }))).status).toBe(200);
  });

  it("never authenticates an extension-origin auth request by cookie", async () => {
    const res = await authRoute.GET(
      authRequest("/get-session", { method: "GET", headers: { origin: EXT_ORIGIN, cookie: alice.cookie } }),
    );
    expect(await res.json()).toBeNull();
  });

  it("deleting the account removes the user's rows and resume files", async () => {
    const res = await authRoute.POST(
      authRequest("/delete-user", { body: { password: "correct-horse-battery" }, headers: { cookie: alice.cookie } })
    );
    expect(res.status).toBe(200);
    expect(blob.del).toHaveBeenCalledWith(["https://blob.example/resumes/alice.pdf"]);
    const db = testDb.current!.db;
    expect(await db.select().from(schema.applications)).toEqual([]);
    expect(await db.select().from(schema.resumes)).toEqual([]);
    expect((await db.select().from(schema.user)).map((u) => u.email)).toEqual(["bob@example.com"]);
    expect((await profileRoute.GET(api("/api/profile", { headers: bearer(alice.token) }))).status).toBe(401);
  });
});
