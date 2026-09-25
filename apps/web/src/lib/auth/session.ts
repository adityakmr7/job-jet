import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";
import { HttpError } from "@/lib/http";
import { getAuth } from "./server";
import { isBearerSessionAllowed, isCrossSiteMutation, withTrustedAuthorization } from "./origins";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

export type SessionLookup = (headers: Headers) => Promise<{ user: AuthUser } | null>;

const defaultLookup: SessionLookup = async (headers) => {
  const session = await getAuth().api.getSession({ headers });
  if (!session) return null;
  // Bearer tokens must belong to an extension session (see origins.ts).
  if (headers.has("authorization") && !isBearerSessionAllowed(session.session.userAgent, headers.get("origin"))) {
    return null;
  }
  const { id, email, name, emailVerified } = session.user;
  return { user: { id, email, name, emailVerified } };
};

function appOrigin(): string | undefined {
  try {
    return process.env.BETTER_AUTH_URL ? new URL(process.env.BETTER_AUTH_URL).origin : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolves the signed-in user for a request: the session cookie (web app)
 * or `Authorization: Bearer` (the extension — never from a web origin, and
 * only for extension-minted sessions; see origins.ts). Returns null
 * when there is no valid session.
 */
export async function getRequestUser(req: Request, lookup: SessionLookup = defaultLookup): Promise<AuthUser | null> {
  const headers = withTrustedAuthorization(req.headers);
  const session = await lookup(headers);
  return session?.user ?? null;
}

/**
 * The single auth gate for API routes. Throws HttpError(401) (rendered as a
 * JSON 401 with CORS headers by withErrorHandling) when unauthenticated, and
 * HttpError(403) for a cookie-authenticated mutation from a foreign origin.
 * Every query after this must still be scoped to `user.id` — that is what
 * prevents IDOR; this only establishes who is asking.
 */
export async function requireUser(req: Request, lookup: SessionLookup = defaultLookup): Promise<AuthUser> {
  const headers = withTrustedAuthorization(req.headers);
  if (!headers.has("authorization") && isCrossSiteMutation(req.method, headers, appOrigin())) {
    throw new HttpError(403, "Cross-site request blocked");
  }
  const session = await lookup(headers);
  if (!session) throw new HttpError(401, "Unauthorized");
  return session.user;
}

/** Session for server components (cookie only). */
export async function getSession(): Promise<{ user: AuthUser } | null> {
  const h = new Headers(await nextHeaders());
  h.delete("authorization");
  return defaultLookup(h);
}

/** Server-component gate: redirects to sign-in (returning here afterwards). */
export async function requirePageUser(returnTo: string): Promise<AuthUser> {
  const session = await getSession();
  if (!session) redirect(`/sign-in?redirect=${encodeURIComponent(returnTo)}`);
  return session.user;
}
