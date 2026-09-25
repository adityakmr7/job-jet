import { detectJobApplication } from "../lib/detect";
import { mountFloatingButton, unmountFloatingButton } from "./floating-button";
import { collectFormFields } from "../lib/fields";
import { extractJobDescription, extractJobTitle } from "../lib/jd-extract";
import { isExtensionMessage, isTrustedSender, type ExtensionMessage } from "../lib/messages";

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

if (!globalWindow[GUARD_KEY]) {
  globalWindow[GUARD_KEY] = true;

  let lastUrl = location.href;
  let debounceTimer: number | undefined;

  const runDetection = () => {
    const result = detectJobApplication();

    if (result.isJobApplication) {
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
      unmountFloatingButton();
    }
  };

  const scheduleDetection = () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(runDetection, 400);
  };

  // Initial run.
  scheduleDetection();

  // Job boards are almost all SPAs — watch for client-side route changes
  // since there's no full page load to re-trigger the content script.
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      scheduleDetection();
    }
  }).observe(document.body, { childList: true, subtree: true });

  window.addEventListener("popstate", scheduleDetection);

  // Respond to requests from the side panel (relayed via background).
  chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    // Only the extension's own side panel may ask for page data.
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
