#!/usr/bin/env node
/**
 * OPTIONAL one-off: move users from a Clerk export into Better Auth.
 *
 * Job Jet hasn't launched, so most installs can skip this entirely. Run it
 * only if real people already signed up while the app used Clerk.
 *
 * What it does, per Clerk user (matched by primary email, case-insensitive):
 *   1. Ensures a Better Auth `user` row exists with the Clerk name,
 *      email and email-verified status.
 *   2. Moves their data (profiles, resumes, applications) from the old
 *      Clerk user id to the Better Auth user id, then removes the old row.
 *      Migration 0002 already copied Clerk-era rows into "user" with their
 *      Clerk ids so nothing is orphaned; this replaces those ids with fresh
 *      Better Auth ids and fills in names/verification.
 *   3. If someone already created a Better Auth account with the same
 *      email, their data is merged into that account instead.
 *
 * Passwords are NOT migrated (Clerk exports bcrypt digests; Better Auth
 * uses scrypt). Users either click "Forgot password" or "Continue with
 * Google" — Google sign-in links automatically to the account with the
 * same, verified email (account linking with Google as a trusted provider).
 * That's why carrying over `emailVerified` from Clerk matters.
 *
 * Input: the CSV from Clerk Dashboard → Users → Export, or a JSON array of
 * Clerk Backend API user objects (GET /v1/users).
 *
 * Usage (from apps/web; DATABASE_URL must point at the target database):
 *   node scripts/migrate-clerk-users.mjs --file clerk-users.csv            # dry run (default)
 *   node scripts/migrate-clerk-users.mjs --file clerk-users.csv --apply    # write changes
 *   npm run auth:migrate-clerk -- --file clerk-users.csv [--apply]        # uses .env.local
 *
 * Run migrations first (npm run db:migrate). Each user is migrated in its
 * own transaction; re-running is safe (already-migrated users are skipped).
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const APP_TABLES = ["profiles", "resumes", "applications"];

/** Minimal RFC 4180 CSV parser (quotes, escaped quotes, CRLF). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...data] = rows.filter((r) => r.some((v) => v.trim() !== ""));
  if (!header) return [];
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

const splitList = (v) =>
  String(v ?? "")
    .split(/[\s,;|]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

/** Normalises one Clerk user (CSV row or Backend API object). */
export function normalizeClerkUser(raw) {
  if (!raw || typeof raw !== "object") return null;
  const clerkId = String(raw.id ?? raw.user_id ?? "").trim();
  if (!clerkId) return null;

  let email = "";
  let verified = false;
  let hasGoogle = false;
  if (Array.isArray(raw.email_addresses)) {
    const primary = raw.email_addresses.find((e) => e.id === raw.primary_email_address_id) ?? raw.email_addresses[0];
    email = String(primary?.email_address ?? "").toLowerCase();
    verified = primary?.verification?.status === "verified";
    hasGoogle = Array.isArray(raw.external_accounts) && raw.external_accounts.some((a) => /google/.test(String(a.provider ?? "")));
  } else {
    email = String(raw.primary_email_address ?? raw.email ?? raw.email_address ?? "").toLowerCase();
    verified = splitList(raw.verified_email_addresses).includes(email);
  }
  email = email.trim();
  if (!email || !email.includes("@")) return null;

  const first = String(raw.first_name ?? "").trim();
  const last = String(raw.last_name ?? "").trim();
  const name = [first, last].filter(Boolean).join(" ") || String(raw.username ?? "").trim() || email.split("@")[0];
  const image = typeof raw.image_url === "string" && raw.image_url.startsWith("https://") ? raw.image_url : null;
  return { clerkId, email, name, emailVerified: verified, image, hasGoogle };
}

export function loadClerkExport(text, fileName = "") {
  const trimmed = text.trim();
  const records = fileName.endsWith(".json") || trimmed.startsWith("[") || trimmed.startsWith("{")
    ? (() => {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : Array.isArray(parsed.data) ? parsed.data : [parsed];
      })()
    : parseCsv(text);
  const users = [];
  const skipped = [];
  for (const r of records) {
    const u = normalizeClerkUser(r);
    if (u) users.push(u);
    else skipped.push(r?.id ?? "(no id)");
  }
  return { users, skipped };
}

/** Better Auth-style id: 32 URL-safe random characters. */
export function newUserId() {
  return randomBytes(24).toString("base64url").slice(0, 32);
}

/**
 * Migrates one user. `db` needs `query(text, params) -> { rows }` (pg
 * Client/PoolClient or PGlite). Returns a description of what happened.
 */
export async function migrateUser(db, u, { apply, idFactory = newUserId }) {
  const byEmail = (await db.query(`SELECT id, email_verified FROM "user" WHERE lower(email) = $1`, [u.email])).rows[0];
  const byClerkId = (await db.query(`SELECT id FROM "user" WHERE id = $1`, [u.clerkId])).rows[0];

  if (byEmail && byEmail.id !== u.clerkId && !byClerkId) {
    // Already a Better Auth user and nothing left under the Clerk id.
    if (apply && u.emailVerified && !byEmail.email_verified) {
      await db.query(`UPDATE "user" SET email_verified = true, updated_at = now() WHERE id = $1`, [byEmail.id]);
    }
    return { action: "already-migrated", userId: byEmail.id };
  }

  const targetId = byEmail && byEmail.id !== u.clerkId ? byEmail.id : idFactory();
  const action = byEmail && byEmail.id !== u.clerkId ? "merged-into-existing" : byClerkId ? "re-keyed" : "created";
  if (!apply) return { action, userId: targetId, dryRun: true };

  await db.query("BEGIN");
  try {
    if (action !== "merged-into-existing") {
      // Temporary unique email; the real one is set after the old row goes.
      await db.query(
        `INSERT INTO "user" (id, name, email, email_verified, image, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, now(), now())`,
        [targetId, u.name, `migrating+${targetId}@invalid`, u.emailVerified, u.image]
      );
    }
    if (byClerkId) {
      for (const table of APP_TABLES) {
        if (table === "profiles" && action === "merged-into-existing") {
          const has = (await db.query(`SELECT 1 FROM profiles WHERE user_id = $1`, [targetId])).rows.length > 0;
          if (has) continue; // keep the newer Better Auth profile; old one is dropped with the Clerk row
        }
        if (table === "applications" && action === "merged-into-existing") {
          // (user_id, url) is unique — skip duplicates already tracked by the new account.
          await db.query(
            `UPDATE applications a SET user_id = $1 WHERE a.user_id = $2
             AND NOT EXISTS (SELECT 1 FROM applications b WHERE b.user_id = $1 AND b.url = a.url)`,
            [targetId, u.clerkId]
          );
          continue;
        }
        await db.query(`UPDATE ${table} SET user_id = $1 WHERE user_id = $2`, [targetId, u.clerkId]);
      }
      await db.query(`DELETE FROM "user" WHERE id = $1`, [u.clerkId]);
    }
    if (action === "merged-into-existing") {
      if (u.emailVerified) await db.query(`UPDATE "user" SET email_verified = true, updated_at = now() WHERE id = $1`, [targetId]);
    } else {
      await db.query(`UPDATE "user" SET email = $1 WHERE id = $2`, [u.email, targetId]);
    }
    await db.query("COMMIT");
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
  return { action, userId: targetId };
}

function parseArgs(argv) {
  const args = { apply: false, file: "" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--apply") args.apply = true;
    else if (argv[i] === "--dry-run") args.apply = false;
    else if (argv[i] === "--file") args.file = argv[++i] ?? "";
    else if (argv[i] === "--help" || argv[i] === "-h") args.help = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.file) {
    console.log("Usage: node scripts/migrate-clerk-users.mjs --file <clerk-export.csv|json> [--apply]");
    process.exit(args.help ? 0 : 1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  const { users, skipped } = loadClerkExport(readFileSync(args.file, "utf8"), args.file);
  console.log(`${users.length} Clerk user(s) to process${skipped.length ? `, ${skipped.length} skipped (no id/email)` : ""}.`);
  console.log(args.apply ? "APPLY mode — writing changes." : "Dry run — no changes will be written (pass --apply).");

  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  const client = await pool.connect();
  const counts = {};
  try {
    for (const u of users) {
      try {
        const result = await migrateUser(client, u, { apply: args.apply });
        counts[result.action] = (counts[result.action] ?? 0) + 1;
        console.log(`  ${u.email}: ${result.action}${u.hasGoogle ? " (had Google sign-in)" : ""}`);
      } catch (err) {
        counts.failed = (counts.failed ?? 0) + 1;
        console.error(`  ${u.email}: FAILED — ${err.message}`);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
  console.log("Summary:", counts);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
