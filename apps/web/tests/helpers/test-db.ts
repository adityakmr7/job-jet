import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";

/**
 * In-process Postgres (PGlite, WASM) with the real Drizzle migrations
 * applied — lets route/auth tests run against actual SQL (and exercises the
 * migration files themselves) with no database server, locally or in CI.
 */
const root = join(__dirname, "..", "..");

export async function createTestDb() {
  const client = new PGlite();
  const journal = JSON.parse(readFileSync(join(root, "drizzle/meta/_journal.json"), "utf8")) as {
    entries: { tag: string }[];
  };
  for (const { tag } of journal.entries) {
    const sql = readFileSync(join(root, "drizzle", `${tag}.sql`), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) await client.exec(statement);
    }
  }
  return { client, db: drizzle(client, { schema }) };
}
