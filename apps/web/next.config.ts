import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (via pdfjs-dist) dynamically resolves its own worker script
  // by file path at runtime — bundling it breaks that resolution ("Setting
  // up fake worker failed: Cannot find module '.../pdf.worker.mjs'").
  // Excluding it from the server bundle so it's loaded via native
  // require() from node_modules, where the relative path actually
  // resolves, fixes it. Same category of issue Next's own docs list
  // sharp/canvas/@react-pdf/renderer under.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
