import { loadEnv, type ConfigEnv } from "vite";
import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";
import { frontendApiFromPublishableKey } from "./src/lib/clerk";

export default defineManifest((configEnv: ConfigEnv) => {
  const env = loadEnv(configEnv.mode, process.cwd(), "VITE_");
  const publishableKey = env.VITE_CLERK_PUBLISHABLE_KEY;

  // `<all_urls>` (needed anyway for job-page detection on arbitrary sites)
  // already covers the Clerk sync host + Frontend API for host_permissions
  // purposes, but Clerk's SDK validates the key exists at all — computing
  // it here documents the actual dependency even though it's redundant
  // with <all_urls> today.
  if (publishableKey) frontendApiFromPublishableKey(publishableKey);

  return {
    manifest_version: 3,
    name: "Job Jet — Auto Apply Assistant",
    description:
      "Detects job application forms on any site and helps you autofill them or generate a tailored resume from the job description.",
    version: pkg.version,
    icons: {
      16: "icons/icon16.png",
      48: "icons/icon48.png",
      128: "icons/icon128.png",
    },
    action: {
      default_icon: {
        16: "icons/icon16.png",
        48: "icons/icon48.png",
        128: "icons/icon128.png",
      },
    },
    background: {
      service_worker: "src/background/index.ts",
      type: "module",
    },
    content_scripts: [
      {
        matches: ["<all_urls>"],
        js: ["src/content/index.ts"],
        run_at: "document_idle",
        all_frames: true,
      },
    ],
    side_panel: {
      default_path: "src/sidepanel/index.html",
    },
    // storage: required by @clerk/chrome-extension unconditionally.
    // cookies: required because we use syncHost (session sync with the web app).
    permissions: ["storage", "cookies", "activeTab", "scripting", "sidePanel"],
    host_permissions: ["<all_urls>"],
  };
});
