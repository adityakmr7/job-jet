import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { requireEnv } from "@/lib/env";

// Lazy initialization: DATABASE_URL isn't set at build time (e.g. before
// Marketplace provisioning runs), and `neon()` throws immediately if it's
// missing. A plain lazy `let` — not a Proxy — keeps this safe for libraries
// that introspect the db client (adapters, etc.).
function createDb() {
  const sql = neon(requireEnv("DATABASE_URL"));
  return drizzle(sql, { schema });
}

let _db: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!_db) _db = createDb();
  return _db;
}
