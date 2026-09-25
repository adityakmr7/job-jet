import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { requireEnv } from "@/lib/env";

export type Db = NeonHttpDatabase<typeof schema>;

/** True for a plain local Postgres (localhost / 127.0.0.1 / ::1) — Neon's
 *  HTTP driver only talks to Neon, so local development and the auth E2E
 *  check use node-postgres instead. Production (Neon) always uses HTTP. */
export function isLocalDatabaseUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(hostname);
  } catch {
    return false;
  }
}

// Lazy initialization: DATABASE_URL isn't set at build time (e.g. before
// Marketplace provisioning runs), and `neon()` throws immediately if it's
// missing. A plain lazy `let` — not a Proxy — keeps this safe for libraries
// that introspect the db client (the Better Auth Drizzle adapter, etc.).
function createDb(): Db {
  const url = requireEnv("DATABASE_URL");
  if (isLocalDatabaseUrl(url)) {
    // Same query-builder API; the cast keeps one Db type for callers.
    return drizzlePg(new Pool({ connectionString: url, max: 5 }), { schema }) as unknown as Db;
  }
  return drizzleNeon(neon(url), { schema });
}

let _db: Db | null = null;

export function getDb(): Db {
  if (!_db) _db = createDb();
  return _db;
}
