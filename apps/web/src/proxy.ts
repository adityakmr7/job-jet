import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Everything under /api is used by the extension and must be authenticated;
// the rest of the app (marketing/sign-in pages) stays public by default.
const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/api(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  // CORS preflight from the extension (chrome-extension://) carries no
  // auth — let it through so the route's own OPTIONS handler can answer
  // with the right Access-Control-* headers. The real request right after
  // still goes through auth.protect() below.
  if (req.method === "OPTIONS") return;
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
