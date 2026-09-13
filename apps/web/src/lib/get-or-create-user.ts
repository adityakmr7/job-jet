import { currentUser } from "@clerk/nextjs/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";

/**
 * Every profile/resume/application row FKs to `users.id`. Clerk is the
 * source of truth for identity, so rather than syncing via webhooks (extra
 * infra, extra failure mode) we lazily upsert a matching row the first time
 * an authenticated request touches the DB.
 */
export async function getOrCreateUser() {
  const user = await currentUser();
  if (!user) return null;

  const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
  if (!email) return null;

  const db = getDb();
  await db
    .insert(users)
    .values({ id: user.id, email })
    .onConflictDoUpdate({ target: users.id, set: { email } });

  return { id: user.id, email };
}
