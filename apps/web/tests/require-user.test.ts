import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server", () => ({ getAuth: () => { throw new Error("real auth must not be used here"); } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const { requireUser, getRequestUser } = await import("@/lib/auth/session");
const { withErrorHandling } = await import("@/lib/http");

const ID = "abcdefghijklmnopabcdefghijklmnop";
const USER = { id: "u1", email: "a@example.com", name: "A", emailVerified: true };

process.env.ALLOWED_EXTENSION_IDS = ID;
process.env.BETTER_AUTH_URL = "https://jobjet.example.com";

describe("requireUser", () => {
  it("returns the user when the lookup finds a session", async () => {
    const lookup = vi.fn(async () => ({ user: USER }));
    await expect(requireUser(new Request("https://jobjet.example.com/api/x"), lookup)).resolves.toEqual(USER);
  });

  it("throws a 401 HttpError without a session", async () => {
    await expect(requireUser(new Request("https://jobjet.example.com/api/x"), async () => null)).rejects.toMatchObject({
      status: 401,
      message: "Unauthorized",
    });
  });

  it("passes bearer tokens to the session lookup only from the allowed extension", async () => {
    const lookup = vi.fn(async (headers: Headers) => (headers.get("authorization") ? { user: USER } : null));
    const fromExtension = new Request("https://jobjet.example.com/api/x", {
      headers: { authorization: "Bearer t", origin: `chrome-extension://${ID}` },
    });
    const fromWebsite = new Request("https://jobjet.example.com/api/x", {
      headers: { authorization: "Bearer t", origin: "https://evil.example" },
    });
    await expect(requireUser(fromExtension, lookup)).resolves.toEqual(USER);
    await expect(requireUser(fromWebsite, lookup)).rejects.toMatchObject({ status: 401 });
    expect(await getRequestUser(fromWebsite, lookup)).toBeNull();
  });

  it("rejects cookie-authenticated cross-site mutations before looking up the session", async () => {
    const lookup = vi.fn(async () => ({ user: USER }));
    const req = new Request("https://jobjet.example.com/api/x", { method: "POST", headers: { origin: "https://evil.example" } });
    await expect(requireUser(req, lookup)).rejects.toMatchObject({ status: 403 });
    expect(lookup).not.toHaveBeenCalled();
  });

  it("renders as a JSON 401 with CORS headers inside withErrorHandling", async () => {
    const handler = withErrorHandling("test", async (req: Request) => {
      await requireUser(req, async () => null);
      return new Response("unreachable");
    });
    const res = await handler(new Request("https://jobjet.example.com/api/x", { headers: { origin: `chrome-extension://${ID}` } }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(res.headers.get("access-control-allow-origin")).toBe(`chrome-extension://${ID}`);
  });
});
