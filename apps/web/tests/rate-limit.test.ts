import { describe, expect, it, vi } from "vitest";
import { checkRateLimit, enforceRateLimit, windowStartFor, type RateLimitStore } from "@/lib/rate-limit";

const rule = { name: "test", limit: 3, windowMs: 60_000 };

function memoryStore(): RateLimitStore & { counts: Map<string, number> } {
  const counts = new Map<string, number>();
  const store = (async (key: string, windowStart: Date) => {
    const k = `${key}@${windowStart.toISOString()}`;
    const next = (counts.get(k) ?? 0) + 1;
    counts.set(k, next);
    return next;
  }) as RateLimitStore & { counts: Map<string, number> };
  store.counts = counts;
  return store;
}

describe("windowStartFor", () => {
  it("floors to the start of the fixed window", () => {
    expect(windowStartFor(125_000, 60_000).getTime()).toBe(120_000);
    expect(windowStartFor(120_000, 60_000).getTime()).toBe(120_000);
  });
});

describe("checkRateLimit", () => {
  it("allows up to the limit then blocks within a window", async () => {
    const store = memoryStore();
    const now = 1_000_000;
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await checkRateLimit(rule, "u1", store, now));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results.map((r) => r.remaining)).toEqual([2, 1, 0, 0]);
  });

  it("resets in the next window and reports seconds until reset", async () => {
    const store = memoryStore();
    const start = 600_000; // window boundary
    for (let i = 0; i < 3; i++) await checkRateLimit(rule, "u1", store, start + 1_000);
    const blocked = await checkRateLimit(rule, "u1", store, start + 45_500);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(15);
    expect((await checkRateLimit(rule, "u1", store, start + 60_000)).allowed).toBe(true);
  });

  it("keys counters per user and per bucket", async () => {
    const store = memoryStore();
    for (let i = 0; i < 3; i++) await checkRateLimit(rule, "u1", store, 0);
    expect((await checkRateLimit(rule, "u2", store, 0)).allowed).toBe(true);
    expect((await checkRateLimit({ ...rule, name: "other" }, "u1", store, 0)).allowed).toBe(true);
  });
});

describe("enforceRateLimit", () => {
  it("returns null while under the limit", async () => {
    const store = memoryStore();
    expect(await enforceRateLimit(rule, "u1", {}, store)).toBeNull();
  });

  it("returns a 429 JSON response with Retry-After and CORS headers when over", async () => {
    const store: RateLimitStore = async () => rule.limit + 1;
    const res = await enforceRateLimit(rule, "u1", { "Access-Control-Allow-Origin": "chrome-extension://x" }, store);
    expect(res?.status).toBe(429);
    expect(Number(res?.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(res?.headers.get("Access-Control-Allow-Origin")).toBe("chrome-extension://x");
    expect(await res?.json()).toMatchObject({ error: expect.stringContaining("Too many requests") });
  });

  it("fails open (and logs) if the store errors", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const store: RateLimitStore = async () => {
      throw new Error("db down");
    };
    expect(await enforceRateLimit(rule, "u1", {}, store)).toBeNull();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
