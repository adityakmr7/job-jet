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
        // Top frame only. Found live, on two separate real sites, why
        // all_frames: true is actively harmful with nothing to show for
        // it today: (1) job-boards.greenhouse.io's reCAPTCHA + Places-
        // autocomplete iframes each got their own content-script
        // instance, and chrome.tabs.sendMessage (no frameId given)
        // broadcasts to every frame — whichever iframe's empty
        // collectFormFields() result happened to respond first silently
        // beat the real page's, surfacing as "0 fields detected" despite
        // the real form clearly having fields. (2) linkedin.com/feed
        // mounted the floating button three times on one page — once in
        // the top document and once in each of two same-origin internal
        // iframes, each independently passing the detection heuristic;
        // mountFloatingButton()'s existing "already mounted" guard only
        // checks within one document, so it can't prevent a second
        // mount in a different frame's own DOM. No ATS we currently
        // support is iframe-embedded, so there's no present use case
        // this trades away — if one shows up, it should be a deliberate,
        // targeted feature (the top frame scanning for known-ATS iframe
        // src URLs and messaging that specific frame), not blanket
        // injection into every iframe on every page (ads, trackers,
        // embeds included).
        all_frames: false,
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
