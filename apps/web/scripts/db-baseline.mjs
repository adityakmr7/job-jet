#!/usr/bin/env node
/**
 * One-time baseline for a database that was created with `drizzle-kit push`
 * (before this repo had migrations).
 *
 * It records drizzle/0000_initial_schema.sql as already applied in
 * drizzle.__drizzle_migrations — exactly the row `drizzle-kit migrate`
 * itself would have written — WITHOUT running it. After this, `npm run
 * db:migrate` applies only the later migrations (0001+).
 *
 * Safety checks: refuses to run if any migration is already recorded, or if
 * the existing schema doesn't look like Job Jet's (no public.users table).
 *
 * Usage (from apps/web):
 *   npm run db:baseline                      # uses .env.local
 *   DATABASE_URL=... node scripts/db-baseline.mjs
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const journal = JSON.parse(readFileSync(join(root, "drizzle/meta/_journal.json"), "utf8"));
const baseline = journal.entries[0];
if (!baseline || baseline.tag !== "0000_initial_schema") {
  console.error("Unexpected migration journal: first entry should be 0000_initial_schema.");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = neon(url);
const query = readFileSync(join(root, "drizzle", `${baseline.tag}.sql`), "utf8");
const hash = createHash("sha256").update(query).digest("hex");

const [{ exists: hasUsers }] = await sql`select to_regclass('public.users') is not null as exists`;
if (!hasUsers) {
  console.error(
    "public.users does not exist — this looks like an empty database. Don't baseline it; run `npm run db:migrate` instead."
  );
  process.exit(1);
}

await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
await sql`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`;
const existing = await sql`select count(*)::int as count from drizzle.__drizzle_migrations`;
if (existing[0].count > 0) {
  console.error("drizzle.__drizzle_migrations already has rows — this database is already baselined/migrated. Nothing to do.");
  process.exit(1);
}

await sql`insert into drizzle.__drizzle_migrations (hash, created_at) values (${hash}, ${baseline.when})`;
console.log(`Baselined ${baseline.tag} (created_at=${baseline.when}). Now run: npm run db:migrate`);
