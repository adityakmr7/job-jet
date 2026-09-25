import { loadEnv, type ConfigEnv } from "vite";
import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";
import { externallyConnectableMatch } from "./env.config";

export default defineManifest((configEnv: ConfigEnv) => {
  const env = loadEnv(configEnv.mode, process.cwd(), "VITE_");
  const apiBaseUrl = env.VITE_API_BASE_URL;
  // Only the Job Jet web app may message the extension (the
  // /extension-connect token handoff). Production builds refuse localhost
  // (env.config.ts), so dev origins never ship in a release. Without an
  // API URL (vitest loading this config) nothing is external-connectable.
  const externalMatches = apiBaseUrl ? [externallyConnectableMatch(apiBaseUrl)] : [];

  return {
    manifest_version: 3,
    // Store limits: name ≤ 75, description ≤ 132 characters.
    name: "Job Jet — Autofill Job Applications & Tailor Your Resume",
    short_name: "Job Jet",
    description:
      "Autofill job applications on any careers site, tailor your resume to each role, and track every application you send.",
    version: pkg.version,
    icons: {
      16: "icons/icon16.png",
      32: "icons/icon32.png",
      48: "icons/icon48.png",
      128: "icons/icon128.png",
    },
    action: {
      default_title: "Open Job Jet",
      default_icon: {
        16: "icons/icon16.png",
        32: "icons/icon32.png",
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
    // Permission justifications (also in store-assets/LISTING.md and SECURITY.md):
    // storage: the extension's session token (chrome.storage.local) and the
    //   one-time connect nonce (chrome.storage.session) — see src/lib/auth.ts.
    // cookies was dropped with Clerk: auth is a bearer token handed over by
    //   the web app's /extension-connect page, no cookie access needed.
    // scripting: fills React/Vue-controlled inputs from the MAIN world
    //   (see src/lib/main-world-fill.ts) — only on the tab the user is
    //   actively autofilling, only after they click Autofill.
    // sidePanel: the extension's UI.
    // downloads: lets the tailored-resume flow save the generated PDF
    //   straight to disk (chrome.downloads.download) instead of only
    //   opening it in a tab, so it's immediately available to pick in the
    //   ATS form's own file-upload dialog.
    // activeTab was dropped: it's fully redundant with the <all_urls> host
    // permission below, which the content script needs anyway to detect
    // application forms on arbitrary career sites (there's no fixed list
    // of ATS domains to narrow it to — see ARCHITECTURE.md).
    permissions: ["storage", "scripting", "sidePanel", "downloads"],
    host_permissions: ["<all_urls>"],
    // Web pages can message the extension only from the Job Jet web app, and
    // no other extension can (ids: [] would be the default anyway; explicit).
    externally_connectable: { matches: externalMatches, ids: [] },
    // Explicit MV3 policy: no remote or inline code in extension pages.
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'",
    },
    // chrome.sidePanel.open() (used by the floating button) needs 116+.
    minimum_chrome_version: "116",
  };
});
