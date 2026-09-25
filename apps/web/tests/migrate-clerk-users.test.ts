import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { loadClerkExport, migrateUser, normalizeClerkUser, parseCsv } from "../scripts/migrate-clerk-users.mjs";

const root = join(__dirname, "..");
async function dbAtVersion(tags: string[]) {
  const db = new PGlite();
  for (const tag of tags) {
    for (const s of readFileSync(join(root, "drizzle", `${tag}.sql`), "utf8").split("--> statement-breakpoint")) {
      if (s.trim()) await db.exec(s);
    }
  }
  return db;
}

describe("Clerk export parsing", () => {
  it("parses the dashboard CSV export", () => {
    const csv =
      'id,first_name,last_name,username,primary_email_address,verified_email_addresses,unverified_email_addresses,password_digest\n' +
      'user_1,Ada,Lovelace,,Ada@Example.com,"ada@example.com",,$2a$10$x\r\n' +
      'user_2,,,grace,grace@example.com,,grace@example.com,\n' +
      ',,,,nobody@example.com,,,\n';
    expect(parseCsv(csv)).toHaveLength(3);
    const { users, skipped } = loadClerkExport(csv, "users.csv");
    expect(users).toEqual([
      { clerkId: "user_1", email: "ada@example.com", name: "Ada Lovelace", emailVerified: true, image: null, hasGoogle: false },
      { clerkId: "user_2", email: "grace@example.com", name: "grace", emailVerified: false, image: null, hasGoogle: false },
    ]);
    expect(skipped).toHaveLength(1);
  });

  it("parses Backend API JSON users", () => {
    const u = normalizeClerkUser({
      id: "user_3",
      first_name: "Linus",
      image_url: "https://img.clerk.com/x",
      primary_email_address_id: "e2",
      email_addresses: [
        { id: "e1", email_address: "old@example.com", verification: { status: "verified" } },
        { id: "e2", email_address: "Linus@Example.com", verification: { status: "verified" } },
      ],
      external_accounts: [{ provider: "oauth_google" }],
    });
    expect(u).toEqual({ clerkId: "user_3", email: "linus@example.com", name: "Linus", emailVerified: true, image: "https://img.clerk.com/x", hasGoogle: true });
  });
});

describe("migrateUser", () => {
  const ada = { clerkId: "user_1", email: "ada@example.com", name: "Ada Lovelace", emailVerified: true, image: null, hasGoogle: false };

  it("re-keys a Clerk-era user and moves their data (dry run writes nothing)", async () => {
    const db = await dbAtVersion(["0000_initial_schema", "0001_add_rate_limits"]);
    await db.exec(`
      INSERT INTO users (id, email) VALUES ('user_1', 'ada@example.com');
      INSERT INTO profiles (user_id, full_name, email) VALUES ('user_1', 'Ada', 'ada@example.com');
      INSERT INTO applications (user_id, url, domain) VALUES ('user_1', 'https://j.example/1', 'j.example');
    `);
    for (const s of readFileSync(join(root, "drizzle/0002_better_auth.sql"), "utf8").split("--> statement-breakpoint")) if (s.trim()) await db.exec(s);

    const dry = await migrateUser(db, ada, { apply: false, idFactory: () => "ba_new_id" });
    expect(dry).toEqual({ action: "re-keyed", userId: "ba_new_id", dryRun: true });
    expect((await db.query(`SELECT id FROM "user"`)).rows).toEqual([{ id: "user_1" }]);

    const res = await migrateUser(db, ada, { apply: true, idFactory: () => "ba_new_id" });
    expect(res).toEqual({ action: "re-keyed", userId: "ba_new_id" });
    expect((await db.query(`SELECT id, email, name, email_verified FROM "user"`)).rows).toEqual([
      { id: "ba_new_id", email: "ada@example.com", name: "Ada Lovelace", email_verified: true },
    ]);
    expect((await db.query(`SELECT user_id FROM profiles`)).rows).toEqual([{ user_id: "ba_new_id" }]);
    expect((await db.query(`SELECT user_id FROM applications`)).rows).toEqual([{ user_id: "ba_new_id" }]);

    // Idempotent.
    expect((await migrateUser(db, ada, { apply: true })).action).toBe("already-migrated");
  });

  it("merges into an account the person already created with Better Auth", async () => {
    const db = await dbAtVersion(["0000_initial_schema", "0001_add_rate_limits"]);
    await db.exec(`
      INSERT INTO users (id, email) VALUES ('user_1', 'ada@example.com');
      INSERT INTO applications (user_id, url, domain) VALUES ('user_1', 'https://j.example/1', 'j.example'), ('user_1', 'https://j.example/2', 'j.example');
    `);
    for (const s of readFileSync(join(root, "drizzle/0002_better_auth.sql"), "utf8").split("--> statement-breakpoint")) if (s.trim()) await db.exec(s);
    // Simulate: old row kept its Clerk id under a different email casing is impossible (unique),
    // so model "new account first" as a fresh DB row + Clerk row with a different stored email.
    await db.exec(`UPDATE "user" SET email = 'ada+clerk@example.com' WHERE id = 'user_1'`);
    await db.exec(`INSERT INTO "user" (id, name, email) VALUES ('ba_existing', 'Ada', 'ada@example.com')`);
    await db.exec(`INSERT INTO applications (user_id, url, domain) VALUES ('ba_existing', 'https://j.example/2', 'j.example')`);

    const res = await migrateUser(db, ada, { apply: true });
    expect(res).toEqual({ action: "merged-into-existing", userId: "ba_existing" });
    expect((await db.query(`SELECT id, email_verified FROM "user"`)).rows).toEqual([{ id: "ba_existing", email_verified: true }]);
    const apps = (await db.query<{ url: string }>(`SELECT url FROM applications WHERE user_id = 'ba_existing' ORDER BY url`)).rows;
    expect(apps.map((a) => a.url)).toEqual(["https://j.example/1", "https://j.example/2"]);
  });

  it("creates users that never touched the database", async () => {
    const db = await dbAtVersion(["0000_initial_schema", "0001_add_rate_limits", "0002_better_auth"]);
    const res = await migrateUser(db, ada, { apply: true, idFactory: () => "fresh" });
    expect(res.action).toBe("created");
    expect((await db.query(`SELECT id, email FROM "user"`)).rows).toEqual([{ id: "fresh", email: "ada@example.com" }]);
  });
});
