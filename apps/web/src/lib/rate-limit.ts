import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { rateLimits } from "@/db/schema";

/**
 * Fixed-window, per-user rate limiting for the expensive (Gemini-backed)
 * endpoints, stored in Postgres (`rate_limits` table) so it works across
 * serverless instances with no extra infrastructure. One atomic upsert per
 * check.
 *
 * If you later add Redis/Upstash, swap the store here — callers only use
 * `enforceRateLimit`.
 */

export interface RateLimitRule {
  /** Logical bucket name, e.g. "resume-tailor". */
  name: string;
  limit: number;
  windowMs: number;
}

const HOUR = 60 * 60 * 1000;

export const RATE_LIMITS = {
  resumeParse: { name: "resume-parse", limit: 10, windowMs: HOUR },
  resumeTailor: { name: "resume-tailor", limit: 20, windowMs: HOUR },
  autofillMap: { name: "autofill-map", limit: 60, windowMs: HOUR },
} satisfies Record<string, RateLimitRule>;

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the current window resets. */
  retryAfterSeconds: number;
}

/** Increments the counter for (key, windowStart) and returns the new count. */
export type RateLimitStore = (key: string, windowStart: Date) => Promise<number>;

export function windowStartFor(nowMs: number, windowMs: number): Date {
  return new Date(Math.floor(nowMs / windowMs) * windowMs);
}

export async function checkRateLimit(
  rule: RateLimitRule,
  userId: string,
  store: RateLimitStore,
  nowMs: number = Date.now()
): Promise<RateLimitResult> {
  const windowStart = windowStartFor(nowMs, rule.windowMs);
  const count = await store(`${rule.name}:${userId}`, windowStart);
  const retryAfterSeconds = Math.max(1, Math.ceil((windowStart.getTime() + rule.windowMs - nowMs) / 1000));
  return {
    allowed: count <= rule.limit,
    limit: rule.limit,
    remaining: Math.max(0, rule.limit - count),
    retryAfterSeconds,
  };
}

export const postgresRateLimitStore: RateLimitStore = async (key, windowStart) => {
  const db = getDb();
  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });
  return row?.count ?? 1;
};

/**
 * Returns a 429 Response if the user is over the limit, otherwise null.
 * Fails open (logs and allows) if the limiter's own DB call fails — the
 * route's own DB work would fail right after anyway, and a limiter outage
 * shouldn't take the feature down on its own.
 */
export async function enforceRateLimit(
  rule: RateLimitRule,
  userId: string,
  headers: HeadersInit = {},
  store: RateLimitStore = postgresRateLimitStore
): Promise<Response | null> {
  let result: RateLimitResult;
  try {
    result = await checkRateLimit(rule, userId, store);
  } catch (err) {
    console.error(`[rate-limit] ${rule.name} check failed, allowing request:`, err);
    return null;
  }
  if (result.allowed) return null;
  return Response.json(
    { error: "Too many requests — please try again later.", retryAfterSeconds: result.retryAfterSeconds },
    {
      status: 429,
      headers: {
        ...(headers as Record<string, string>),
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
      },
    }
  );
}

/** Deletes counters from windows that ended more than a day ago. */
export async function pruneRateLimits(): Promise<void> {
  const db = getDb();
  await db.delete(rateLimits).where(sql`${rateLimits.windowStart} < now() - interval '1 day'`);
}
