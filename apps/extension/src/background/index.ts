import type { ExtensionMessage } from "../lib/messages";

// Let the toolbar icon open the side panel directly too.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender) => {
  if (message.type === "OPEN_SIDE_PANEL") {
    const tabId = sender.tab?.id;
    if (tabId != null) {
      chrome.sidePanel.open({ tabId }).catch((err) => console.error("[job-jet] failed to open side panel", err));
    }
  }
});
