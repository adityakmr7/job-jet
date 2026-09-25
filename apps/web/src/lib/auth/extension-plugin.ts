import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import { makeSignature } from "better-auth/crypto";
import * as z from "zod";
import { extensionSessionLabel, isAllowedExtensionId } from "./origins";

export { extensionSessionLabel };

const bodySchema = z.object({ extensionId: z.string().max(64) });

/**
 * Mints a dedicated, separately revocable session for the Chrome extension.
 *
 * POST /api/auth/extension/token  { extensionId }
 *  - requires a normal cookie session (the user is signed in on the web);
 *  - refuses requests that authenticate with a bearer token, so an
 *    extension token can never mint further tokens;
 *  - only for extension IDs on the ALLOWED_EXTENSION_IDS allowlist;
 *  - Better Auth's origin check (trustedOrigins) rejects cross-site POSTs.
 *
 * Returns a token signed with BETTER_AUTH_SECRET in the same format as the
 * session cookie; the bearer plugin (requireSignature) accepts it in
 * `Authorization: Bearer <token>`. Any previous session for the same
 * extension ID is revoked, so each install holds at most one.
 */
export const extensionConnect = () =>
  ({
    id: "job-jet-extension-connect",
    endpoints: {
      createExtensionToken: createAuthEndpoint(
        "/extension/token",
        { method: "POST", body: bodySchema, use: [sessionMiddleware] },
        async (ctx) => {
          const auth = ctx.request?.headers.get("authorization") ?? ctx.headers?.get("authorization");
          if (auth) {
            throw new APIError("FORBIDDEN", { message: "Extension tokens must be created from a signed-in browser session." });
          }
          const { extensionId } = ctx.body;
          if (!isAllowedExtensionId(extensionId)) {
            throw new APIError("FORBIDDEN", { message: "This extension is not allowed to connect." });
          }

          const userId = ctx.context.session.user.id;
          const label = extensionSessionLabel(extensionId);
          const existing = await ctx.context.internalAdapter.listSessions(userId);
          for (const s of existing) {
            if (s.userAgent === label) await ctx.context.internalAdapter.deleteSession(s.token);
          }

          const session = await ctx.context.internalAdapter.createSession(userId, false, { userAgent: label });
          if (!session) throw new APIError("INTERNAL_SERVER_ERROR", { message: "Couldn't create a session." });

          const signature = await makeSignature(session.token, ctx.context.secret);
          return ctx.json({
            token: encodeURIComponent(`${session.token}.${signature}`),
            expiresAt: new Date(session.expiresAt).toISOString(),
            user: { email: ctx.context.session.user.email, name: ctx.context.session.user.name },
          });
        }
      ),
    },
    rateLimit: [{ pathMatcher: (path: string) => path === "/extension/token", window: 60, max: 10 }],
  }) satisfies BetterAuthPlugin;
