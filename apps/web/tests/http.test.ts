import { describe, expect, it, vi } from "vitest";
import { HttpError, readJsonBody, withErrorHandling } from "@/lib/http";

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request("https://app.example.com/api/x", { method: "POST", body, headers });

describe("readJsonBody", () => {
  it("parses JSON", async () => {
    expect(await readJsonBody(post('{"a":1}'))).toEqual({ a: 1 });
  });

  it("returns null for an empty body", async () => {
    expect(await readJsonBody(post(""))).toBeNull();
  });

  it("throws 400 on invalid JSON", async () => {
    await expect(readJsonBody(post("{nope"))).rejects.toMatchObject({ status: 400 });
  });

  it("throws 413 when the body exceeds the cap (by content or declared length)", async () => {
    await expect(readJsonBody(post(JSON.stringify({ a: "x".repeat(100) })), 50)).rejects.toMatchObject({ status: 413 });
    await expect(readJsonBody(post("{}", { "content-length": "999999" }), 1000)).rejects.toMatchObject({ status: 413 });
  });

  it("counts bytes, not characters", async () => {
    // 20 × "é" = 40 bytes in UTF-8
    await expect(readJsonBody(post(JSON.stringify("é".repeat(20))), 30)).rejects.toMatchObject({ status: 413 });
  });
});

describe("withErrorHandling", () => {
  it("passes successful responses through", async () => {
    const handler = withErrorHandling("t", async () => Response.json({ ok: true }));
    const res = await handler(post("{}"));
    expect(res.status).toBe(200);
  });

  it("maps HttpError to its status with a JSON error", async () => {
    const handler = withErrorHandling("t", async () => {
      throw new HttpError(413, "Too big");
    });
    const res = await handler(post("{}"));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "Too big" });
  });

  it("turns unexpected errors into a generic JSON 500 and logs them", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = withErrorHandling("api/test", async () => {
      throw new Error("connection refused: secret-host:5432");
    });
    const res = await handler(post("{}", { origin: "https://evil.example.com" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "Internal server error" });
    expect(JSON.stringify(body)).not.toContain("secret-host");
    expect(log).toHaveBeenCalledWith("[api/test]", expect.any(Error));
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    log.mockRestore();
  });

  it("forwards extra route arguments (e.g. params)", async () => {
    const handler = withErrorHandling("t", async (_req: Request, ctx: { params: Promise<{ id: string }> }) =>
      Response.json({ id: (await ctx.params).id })
    );
    const res = await handler(post("{}"), { params: Promise.resolve({ id: "abc" }) });
    expect(await res.json()).toEqual({ id: "abc" });
  });
});
