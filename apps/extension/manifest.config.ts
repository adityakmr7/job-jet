import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";

export default defineManifest({
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
  permissions: ["storage", "activeTab", "scripting", "sidePanel"],
  host_permissions: ["<all_urls>"],
});
