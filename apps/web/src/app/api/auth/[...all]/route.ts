import { getAuth } from "@/lib/auth/server";
import { withTrustedAuthorization } from "@/lib/auth/origins";
import { corsHeaders } from "@/lib/cors";

/**
 * Better Auth's handler (sign-in/up, OAuth callbacks, sessions, password
 * reset, extension token, ...). Wrapped to:
 *  - drop `Authorization: Bearer` from web origins (bearer tokens are
 *    extension-only, see withTrustedAuthorization);
 *  - add CORS headers for the extension, which calls get-session and
 *    sign-out cross-origin. Never a wildcard: only allowed extension origins;
 *  - keep the extension strictly bearer-only: cookies are neither read from
 *    nor set on extension-origin or bearer requests. Chrome attaches/stores cookies for
 *    extension fetches to hosts it has permissions for, so without this the
 *    extension's sign-out response would clear the *web* session cookie.
 */
async function handle(req: Request): Promise<Response> {
  const cors = corsHeaders(req.headers.get("origin")) as Record<string, string>;
  const fromExtension = Boolean(cors["Access-Control-Allow-Origin"]);
  let headers = withTrustedAuthorization(req.headers);
  const bearerOnly = fromExtension || headers.has("authorization");
  if (bearerOnly && headers.has("cookie")) {
    headers = new Headers(headers);
    headers.delete("cookie");
  }
  const forwarded = headers === req.headers ? req : new Request(req, { headers });
  const res = await getAuth().handler(forwarded);
  if (!bearerOnly) return res;
  const out = new Response(res.body, res);
  out.headers.delete("set-cookie");
  for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
  return out;
}

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export const GET = handle;
export const POST = handle;
