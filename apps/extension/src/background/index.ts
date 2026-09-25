import { isExtensionMessage, isTrustedSender } from "../lib/messages";
import { handleConnectMessage } from "../lib/auth";

// Let the toolbar icon open the side panel directly too.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.runtime.onMessage.addListener((message: unknown, sender) => {
  if (!isTrustedSender(sender) || !isExtensionMessage(message)) return;
  if (message.type === "OPEN_SIDE_PANEL") {
    // Only content scripts (which always have sender.tab) can ask for the
    // panel, and only for their own tab — never a caller-supplied tab id.
    const tabId = sender.tab?.id;
    if (tabId != null) {
      chrome.sidePanel.open({ tabId }).catch((err) => console.error("[job-jet] failed to open side panel", err));
    }
  }
});

// The only external entry point: the Job Jet web app's /extension-connect
// page handing over an extension session token. externally_connectable
// (manifest) restricts which origins can even reach this listener;
// handleConnectMessage re-checks the exact sender origin + path, the message
// schema and the one-time state nonce before storing anything.
chrome.runtime.onMessageExternal.addListener((message: unknown, sender, sendResponse) => {
  handleConnectMessage(message, sender)
    .then((result) => {
      sendResponse(result);
      if (result.ok && sender.tab?.id != null) {
        // Give the page a moment to show "Connected", then close the tab.
        const tabId = sender.tab.id;
        setTimeout(() => chrome.tabs.remove(tabId).catch(() => {}), 1800);
      }
    })
    .catch(() => sendResponse({ ok: false, error: "internal_error" }));
  return true; // async response
});
