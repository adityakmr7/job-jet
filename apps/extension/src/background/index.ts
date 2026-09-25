import { isExtensionMessage, isTrustedSender } from "../lib/messages";

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
