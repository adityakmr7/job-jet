import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Fast, optimistic redirect for signed-out visitors to the dashboard and
 * the extension-connect page: only checks that a session cookie exists (no
 * DB call). It is NOT the security boundary — every page and API route
 * verifies the session server-side (requirePageUser / requireUser), and
 * /api routes answer 401 JSON themselves (the extension uses bearer tokens,
 * which this cookie check can't see).
 */
const PROTECTED_PREFIXES = ["/dashboard", "/extension-connect"];

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (!PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  if (getSessionCookie(req)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = `?redirect=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/dashboard/:path*", "/extension-connect"],
};
