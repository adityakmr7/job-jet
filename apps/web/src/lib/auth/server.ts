import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { del } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { isEmailProviderConfigured, isGoogleAuthConfigured, optionalEnv, requireEnv } from "@/lib/env";
import { actionEmail, getEmailSender } from "@/lib/email";
import { extensionConnect } from "./extension-plugin";
import { resolveTrustedOrigins } from "./origins";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "./constants";


function createAuth() {
  const isProduction = process.env.NODE_ENV === "production";
  const emailConfigured = isEmailProviderConfigured();
  const googleClientId = optionalEnv("GOOGLE_CLIENT_ID");
  const googleClientSecret = optionalEnv("GOOGLE_CLIENT_SECRET");

  return betterAuth({
    appName: "Job Jet",
    secret: requireEnv("BETTER_AUTH_SECRET"),
    baseURL: requireEnv("BETTER_AUTH_URL"),
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        rateLimit: schema.authRateLimit,
      },
    }),
    trustedOrigins: (request) => resolveTrustedOrigins(request?.headers.get("origin")),

    emailAndPassword: {
      enabled: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      // Verification is enforced only when a real email provider is
      // configured — otherwise nobody could ever receive the link and every
      // new account would be locked out. Tradeoff documented in README.
      requireEmailVerification: emailConfigured,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: async ({ user, url }) => {
        await getEmailSender().send(
          actionEmail({
            to: user.email,
            subject: "Reset your Job Jet password",
            heading: "Reset your password",
            body: "Someone (hopefully you) asked to reset the password for your Job Jet account. This link expires in 1 hour.",
            actionLabel: "Choose a new password",
            url,
          })
        );
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: emailConfigured,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: async ({ user, url }) => {
        await getEmailSender().send(
          actionEmail({
            to: user.email,
            subject: "Verify your email for Job Jet",
            heading: "Confirm your email address",
            body: "Confirm this address to finish setting up your Job Jet account. The link expires in 24 hours.",
            actionLabel: "Verify email",
            url,
          })
        );
      },
    },
    socialProviders:
      googleClientId && googleClientSecret
        ? { google: { clientId: googleClientId, clientSecret: googleClientSecret, prompt: "select_account" } }
        : {},
    account: {
      accountLinking: {
        enabled: true,
        // A Google sign-in with the same (Google-verified) email links to an
        // existing account — how migrated Clerk users and email+password
        // users add Google. Better Auth still requires the local account's
        // email to be verified first, so a squatter can't pre-register a
        // victim's address and capture their Google identity.
        trustedProviders: ["google"],
      },
    },
    user: {
      deleteUser: {
        enabled: true,
        // Rows in profiles/resumes/applications cascade from user.id; the
        // resume files live in Blob storage, so remove those explicitly.
        beforeDelete: async (user) => {
          await deleteUserBlobs(user.id);
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // refresh expiry at most daily
      freshAge: 60 * 60 * 24, // sensitive actions (delete account) need a sign-in within 24h
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60 * 10, max: 5 },
        "/request-password-reset": { window: 60 * 10, max: 5 },
        "/send-verification-email": { window: 60 * 10, max: 5 },
        "/change-password": { window: 60 * 10, max: 10 },
        "/delete-user": { window: 60 * 10, max: 5 },
      },
    },
    advanced: {
      useSecureCookies: isProduction,
      // Explicit so the CSRF/origin check also runs under NODE_ENV=test
      // (Better Auth skips it in tests by default) — our tests assert it.
      disableOriginCheck: false,
      // Vercel sets x-real-ip to the client address and overwrites
      // client-supplied values; x-forwarded-for chains are client-controlled.
      ipAddress: { ipAddressHeaders: ["x-real-ip", "x-forwarded-for"] },
    },
    telemetry: { enabled: false },
    // bearer: the extension authenticates with `Authorization: Bearer`.
    // requireSignature: only HMAC-signed tokens (as minted by
    // extensionConnect) are accepted, so a raw token read from the DB alone
    // is not usable. nextCookies must stay last.
    plugins: [bearer({ requireSignature: true }), extensionConnect(), nextCookies()],
  });
}

/** Deletes every stored resume file for a user (best effort per file). */
export async function deleteUserBlobs(userId: string): Promise<void> {
  const db = getDb();
  const rows = await db.select({ blobUrl: schema.resumes.blobUrl }).from(schema.resumes).where(eq(schema.resumes.userId, userId));
  const urls = rows.map((r) => r.blobUrl).filter(Boolean);
  if (urls.length === 0) return;
  try {
    await del(urls);
  } catch (err) {
    console.error(`[auth] failed to delete ${urls.length} resume file(s) for a deleted user:`, err);
    throw err;
  }
}

export type Auth = ReturnType<typeof createAuth>;

// Lazy: `next build` imports route modules without secrets present.
let _auth: Auth | null = null;
export function getAuth(): Auth {
  if (!_auth) _auth = createAuth();
  return _auth;
}

export function isGoogleEnabled(): boolean {
  return isGoogleAuthConfigured();
}
