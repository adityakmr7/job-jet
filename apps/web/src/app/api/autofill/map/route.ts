import { NextResponse, after } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { computeFieldSignature, type Profile } from "@job-jet/shared";
import { getDb } from "@/db";
import { profiles, fieldMappings } from "@/db/schema";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { corsHeaders } from "@/lib/cors";
import { resolveProfileFieldPath } from "@/lib/field-paths";
import { matchFieldsToProfilePaths, type FieldForPrompt } from "@/lib/field-mapping-llm";
import { readJsonBody, withErrorHandling } from "@/lib/http";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  AutofillMapRequestSchema,
  isMappingCompatible,
  normalizeSiteKey,
  validationErrorBody,
  type IncomingField,
} from "@/lib/validation";

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

/**
 * Tier 3 of the autofill engine: for fields the heuristic + known-site
 * adapter tiers (both entirely client-side) couldn't recognize, the
 * extension sends them here. Each field is first checked against the
 * crowdsourced `field_mappings` cache (domain + normalized field
 * signature — see computeFieldSignature); only genuine cache misses ever
 * reach the LLM. A mapping decision, once made for a given domain +
 * signature, benefits every user who hits that same field wording again,
 * not just the one who triggered the LLM call.
 *
 * Safety: the model never sees or returns an actual value — see
 * field-paths.ts. It only picks a key from a fixed allow-list; the real
 * value is resolved from THIS user's own profile, in code, after the
 * model call returns. A hallucinated key just fails to resolve, and every
 * mapping (cached or fresh) must also pass isMappingCompatible against the
 * submitted field's type before it's used or cached.
 *
 * Abuse limits: the request body is size-capped and schema-validated, the
 * site key is normalized to a validated hostname, and LLM calls are
 * rate-limited per user (cache hits are not — they cost no model call).
 */
export const POST = withErrorHandling("api/autofill/map POST", async (req: Request) => {
  const headers = corsHeaders(req.headers.get("origin"));
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });

  const parsed = AutofillMapRequestSchema.safeParse(await readJsonBody(req));
  if (!parsed.success) {
    return NextResponse.json(validationErrorBody(parsed.error), { status: 400, headers });
  }
  const domain = normalizeSiteKey(parsed.data.domain);
  const fields = parsed.data.fields;
  if (!domain || fields.length === 0) {
    return NextResponse.json({ mappings: [] }, { headers });
  }

  const db = getDb();
  const [profileRow] = await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1);
  if (!profileRow) {
    // Nothing to resolve values against yet — still a well-formed empty
    // response, not an error (mirrors fetchProfile's "no profile yet" case).
    return NextResponse.json({ mappings: [] }, { headers });
  }
  // Normalize the DB row's nullable jsonb columns against the shared
  // Profile shape (same pattern as resume/tailor/route.ts) before it's
  // passed to resolveProfileFieldPath.
  const profile: Profile = {
    id: profileRow.id,
    userId: profileRow.userId,
    fullName: profileRow.fullName,
    email: profileRow.email,
    phone: profileRow.phone ?? undefined,
    location: profileRow.location ?? undefined,
    links: profileRow.links ?? [],
    summary: profileRow.summary ?? undefined,
    education: profileRow.education ?? [],
    experience: profileRow.experience ?? [],
    skills: profileRow.skills ?? [],
    workAuthorization: profileRow.workAuthorization ?? undefined,
  };

  const withSignature = fields.map((f) => ({ field: f, signature: computeFieldSignature(f) }));
  const signatures = [...new Set(withSignature.map((w) => w.signature))];

  const cached = signatures.length
    ? await db
        .select()
        .from(fieldMappings)
        .where(and(eq(fieldMappings.domain, domain), inArray(fieldMappings.fieldSignature, signatures)))
    : [];
  const cacheBySignature = new Map(cached.map((c) => [c.fieldSignature, c]));

  const results: { selector: string; value: string }[] = [];
  const cacheHitSignatures: string[] = [];
  const uncached: { field: IncomingField; signature: string }[] = [];

  for (const w of withSignature) {
    const hit = cacheBySignature.get(w.signature);
    if (hit && isMappingCompatible(hit.profileFieldPath, w.field)) {
      cacheHitSignatures.push(w.signature);
      const value = resolveProfileFieldPath(profile, hit.profileFieldPath);
      if (value) results.push({ selector: w.field.selector, value });
    } else if (hit) {
      // Invalid/incompatible cached decision — ignore it for this field
      // rather than re-asking the model (it'd likely answer the same).
      continue;
    } else {
      uncached.push(w);
    }
  }

  // Bump hitCount for cache hits — pure bookkeeping, not needed for the
  // response. Scheduled via after() rather than a bare un-awaited
  // promise: on Vercel, the function's execution environment can be torn
  // down right after the response is sent, so a fire-and-forget promise
  // that was never awaited isn't actually guaranteed to finish. after()
  // is the platform's own mechanism for "run this once the response has
  // gone out" — it keeps the invocation alive long enough for the work to
  // complete without making the caller wait for it.
  if (cacheHitSignatures.length) {
    after(() =>
      db
        .update(fieldMappings)
        .set({ hitCount: sql`${fieldMappings.hitCount} + 1`, updatedAt: new Date() })
        .where(and(eq(fieldMappings.domain, domain), inArray(fieldMappings.fieldSignature, cacheHitSignatures)))
        .catch(() => {})
    );
  }

  const rateLimited =
    uncached.length > 0 ? await enforceRateLimit(RATE_LIMITS.autofillMap, user.id, headers) : null;
  if (rateLimited) {
    // Best-effort tier: over the limit just means no LLM matching this
    // time; cached mappings above are still returned.
    return NextResponse.json({ mappings: results, rateLimited: true }, { headers });
  }

  if (uncached.length > 0) {
    const forPrompt: FieldForPrompt[] = uncached.map((u, index) => ({
      index,
      label: u.field.label,
      name: u.field.name,
      placeholder: u.field.placeholder,
      type: u.field.type,
      options: u.field.options,
    }));

    try {
      const matches = await matchFieldsToProfilePaths(forPrompt);
      const newCacheRows: { domain: string; fieldSignature: string; profileFieldPath: string }[] = [];

      for (const m of matches) {
        if (!m.profileFieldPath) continue;
        const entry = uncached[m.index];
        if (!entry || !isMappingCompatible(m.profileFieldPath, entry.field)) continue;
        const { field, signature } = entry;
        newCacheRows.push({ domain, fieldSignature: signature, profileFieldPath: m.profileFieldPath });

        const value = resolveProfileFieldPath(profile, m.profileFieldPath);
        if (value) results.push({ selector: field.selector, value });
      }

      // Cache the *decision* regardless of whether this particular user's
      // profile had data for it — the mapping (this label means X) is
      // reusable even by a user whose own profile lacks X. Deferred via
      // after() and run concurrently (not one row at a time) — this was
      // previously awaited sequentially before responding, which meant
      // every uncached custom question on the page added its own DB
      // round trip to the user's wait, on top of the LLM call itself,
      // for a write the response doesn't actually depend on.
      if (newCacheRows.length) {
        after(() =>
          Promise.all(
            newCacheRows.map((row) =>
              db
                .insert(fieldMappings)
                .values({ ...row, source: "llm", confidence: 0.7, hitCount: 1 })
                .onConflictDoUpdate({
                  target: [fieldMappings.domain, fieldMappings.fieldSignature],
                  set: { profileFieldPath: row.profileFieldPath, updatedAt: new Date() },
                })
                .catch(() => {})
            )
          )
        );
      }
    } catch (err) {
      // LLM tier is best-effort on top of the two client-side tiers — a
      // failure here (rate limit, model hiccup) should never surface as a
      // hard error to the user, just fewer fields filled this time.
      console.error("[autofill/map] LLM matching failed:", err);
    }
  }

  return NextResponse.json({ mappings: results }, { headers });
});
