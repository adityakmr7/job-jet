import { detectJobApplication, hostMatches } from "../lib/detect";
import { mountFloatingButton, unmountFloatingButton } from "./floating-button";
import { collectFormFields } from "../lib/fields";
import { extractJobDescription, extractJobTitle } from "../lib/jd-extract";
import { isExtensionMessage, isTrustedSender, type ExtensionMessage } from "../lib/messages";
import { shouldActivateInFrame } from "../lib/frames";

/**
 * Guard against running setup twice in the same document. Chrome
 * automatically re-injects content scripts into already-open matching
 * tabs whenever the extension reloads/updates (an MV3 convenience feature
 * so you don't have to manually refresh every open tab) — but it does NOT
 * tear down the previous injection's listeners/observers first. Left
 * unguarded, every extension reload while a job page is already open
 * stacks another `chrome.runtime.onMessage` listener onto that page, and
 * multiple listeners racing to answer the same message is exactly what
 * caused fields to "flicker" between 0 and a real count during testing —
 * whichever stale/fresh listener happened to respond first won. (The
 * extension ID, needed for the backend's ALLOWED_EXTENSION_IDS, is shown
 * on chrome://extensions.)
 */
const GUARD_KEY = "__jobJetContentScriptLoaded";
const globalWindow = window as unknown as Record<string, boolean>;

function isTopFrame(): boolean {
  try {
    return window.top === window;
  } catch {
    return false;
  }
}

const TOP = isTopFrame();

// The manifest injects into every frame (so an embedded Greenhouse/Lever
// form can be filled), but a subframe that isn't itself a known ATS — ads,
// reCAPTCHA, maps, LinkedIn's internal iframes — gets nothing: no
// listener, no observer, no button.
if (!globalWindow[GUARD_KEY] && shouldActivateInFrame(TOP, location.hostname)) {
  globalWindow[GUARD_KEY] = true;

  let lastUrl = location.href;
  let debounceTimer: number | undefined;
  let mounted = false;

  const runDetection = () => {
    const result = detectJobApplication();

    if (result.isJobApplication) {
      mounted = true;
      mountFloatingButton(() => {
        chrome.runtime.sendMessage<ExtensionMessage>({
          type: "OPEN_SIDE_PANEL",
          payload: { tabId: -1 }, // background fills in the real tab id
        });
      });
      chrome.runtime.sendMessage<ExtensionMessage>({
        type: "JOB_DETECTED",
        payload: { url: location.href, confidence: result.confidence, signals: result.signals },
      });
    } else {
      mounted = false;
      unmountFloatingButton();
    }
  };

  const scheduleDetection = (delay = 400) => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(runDetection, delay);
  };

  if (TOP) {
    // The floating button only ever lives in the top document — an embedded
    // ATS frame is announced by the top frame's own detection (it sees the
    // iframe), never by a second button inside the iframe.
    scheduleDetection();

    // Pages where a form can appear without a URL change (an ATS "Apply"
    // button revealing the form, a careers page injecting its Greenhouse
    // embed) are re-checked on DOM changes too — but only while no button
    // is showing and only on pages that look job-related, so an unrelated
    // busy page isn't re-scanned on every mutation.
    const jobish =
      hostMatches(location.hostname) || /job|career|apply|position|opening|vacanc/i.test(location.href);

    // Job boards are almost all SPAs — watch for client-side route changes
    // since there's no full page load to re-trigger the content script.
    new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        scheduleDetection();
      } else if (!mounted && jobish) {
        scheduleDetection(1000);
      }
    }).observe(document.body, { childList: true, subtree: true });

    window.addEventListener("popstate", () => scheduleDetection());
  }

  // Respond to requests from the side panel. The panel addresses each frame
  // by explicit frameId; this listener still only trusts the extension's
  // own contexts.
  chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if (!isTrustedSender(sender) || !isExtensionMessage(message)) return false;
    switch (message.type) {
      case "REQUEST_FORM_FIELDS":
        sendResponse({ type: "FORM_FIELDS_RESULT", payload: { fields: collectFormFields() } });
        return true;
      case "EXTRACT_JOB_DESCRIPTION":
        sendResponse({
          type: "JOB_DESCRIPTION_RESULT",
          payload: { text: extractJobDescription(), title: extractJobTitle() },
        });
        return true;
      default:
        return false;
    }
  });
}
