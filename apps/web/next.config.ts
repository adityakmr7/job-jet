import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./src/lib/security-headers";

const securityHeaders = buildSecurityHeaders({
  clerkPublishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  isDev: process.env.NODE_ENV !== "production",
});

const nextConfig: NextConfig = {
  // pdf-parse (via pdfjs-dist) dynamically resolves its own worker script
  // by file path at runtime — bundling it breaks that resolution ("Setting
  // up fake worker failed: Cannot find module '.../pdf.worker.mjs'").
  // Excluding it from the server bundle so it's loaded via native
  // require() from node_modules, where the relative path actually
  // resolves, fixes it. Same category of issue Next's own docs list
  // sharp/canvas/@react-pdf/renderer under.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  // Don't advertise the framework in every response.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
