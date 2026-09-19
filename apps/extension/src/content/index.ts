import { detectJobApplication } from "../lib/detect";
import { mountFloatingButton, unmountFloatingButton } from "./floating-button";
import { collectFormFields, setFieldValue } from "../lib/fields";
import { extractJobDescription, extractJobTitle } from "../lib/jd-extract";
import type { ExtensionMessage } from "../lib/messages";

let lastUrl = location.href;
let debounceTimer: number | undefined;

// Diagnostic: lets us confirm the loaded extension's real ID against the
// one computed from its unpacked directory path (needed to register
// Clerk's allowed_origins for cross-origin session sync).
console.log("[job-jet] extension id:", chrome.runtime.id);

function runDetection() {
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
}

function scheduleDetection() {
  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(runDetection, 400);
}

// Initial run.
scheduleDetection();

// Job boards are almost all SPAs — watch for client-side route changes since
// there's no full page load to re-trigger the content script.
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    scheduleDetection();
  }
}).observe(document.body, { childList: true, subtree: true });

window.addEventListener("popstate", scheduleDetection);

// Respond to requests from the side panel (relayed via background).
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
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
    case "AUTOFILL_REQUEST": {
      const entries = Object.entries(message.payload.values);
      const filled = entries.filter(([selector, value]) => setFieldValue(selector, value)).length;
      sendResponse({ filled, total: entries.length });
      return true;
    }
    default:
      return false;
  }
});
