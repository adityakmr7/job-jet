import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";

const root = join(__dirname, "..");
const run = async (db: PGlite, tag: string) => {
  const sql = readFileSync(join(root, "drizzle", `${tag}.sql`), "utf8");
  for (const s of sql.split("--> statement-breakpoint")) if (s.trim()) await db.exec(s);
};

describe("0002_better_auth migration", () => {
  it("carries existing (Clerk-era) users and their data over to the Better Auth user table", async () => {
    const db = new PGlite();
    await run(db, "0000_initial_schema");
    await run(db, "0001_add_rate_limits");
    await db.exec(`
      INSERT INTO users (id, email) VALUES ('user_clerk123', 'Ada@Example.com');
      INSERT INTO profiles (user_id, full_name, email) VALUES ('user_clerk123', 'Ada Lovelace', 'ada@example.com');
      INSERT INTO applications (user_id, url, domain) VALUES ('user_clerk123', 'https://jobs.example.com/1', 'jobs.example.com');
    `);

    await run(db, "0002_better_auth");

    const users = await db.query<{ id: string; email: string; name: string; email_verified: boolean }>(
      `SELECT id, email, name, email_verified FROM "user"`
    );
    expect(users.rows).toEqual([{ id: "user_clerk123", email: "ada@example.com", name: "Ada", email_verified: false }]);
    const legacy = await db.query(`SELECT to_regclass('public.users') AS t`);
    expect(legacy.rows[0]).toEqual({ t: null });

    // FK now points at "user": deleting the user cascades to app data.
    await db.exec(`DELETE FROM "user" WHERE id = 'user_clerk123'`);
    expect((await db.query(`SELECT count(*)::int AS n FROM profiles`)).rows[0]).toEqual({ n: 0 });
    expect((await db.query(`SELECT count(*)::int AS n FROM applications`)).rows[0]).toEqual({ n: 0 });
  });

  it("rejects app rows for users that don't exist", async () => {
    const db = new PGlite();
    for (const tag of ["0000_initial_schema", "0001_add_rate_limits", "0002_better_auth"]) await run(db, tag);
    await expect(
      db.exec(`INSERT INTO profiles (user_id, full_name, email) VALUES ('nobody', 'X', 'x@example.com')`)
    ).rejects.toThrow(/foreign key/);
  });
});
