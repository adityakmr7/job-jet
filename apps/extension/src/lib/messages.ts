/** Message contracts between content script, background, and side panel. */

export type ExtensionMessage =
  | { type: "JOB_DETECTED"; payload: { url: string; confidence: number; signals: string[] } }
  | { type: "OPEN_SIDE_PANEL"; payload: { tabId: number } }
  | { type: "REQUEST_FORM_FIELDS" }
  | { type: "FORM_FIELDS_RESULT"; payload: { fields: unknown[] } }
  | { type: "EXTRACT_JOB_DESCRIPTION" }
  | { type: "JOB_DESCRIPTION_RESULT"; payload: { text: string; title?: string } };

const KNOWN_TYPES = new Set<ExtensionMessage["type"]>([
  "JOB_DETECTED",
  "OPEN_SIDE_PANEL",
  "REQUEST_FORM_FIELDS",
  "FORM_FIELDS_RESULT",
  "EXTRACT_JOB_DESCRIPTION",
  "JOB_DESCRIPTION_RESULT",
]);

/** Structural check for an incoming message — anything arriving through
 *  chrome.runtime.onMessage is treated as untrusted input. */
export function isExtensionMessage(value: unknown): value is ExtensionMessage {
  if (typeof value !== "object" || value === null) return false;
  const type = (value as { type?: unknown }).type;
  return typeof type === "string" && KNOWN_TYPES.has(type as ExtensionMessage["type"]);
}

/**
 * Only accept messages sent by this extension's own contexts. Without
 * `externally_connectable` web pages can't reach chrome.runtime.onMessage
 * and other extensions arrive via onMessageExternal, so this is defense in
 * depth — but it keeps the handlers safe if either of those ever changes.
 */
export function isTrustedSender(sender: chrome.runtime.MessageSender, extensionId = chrome.runtime.id): boolean {
  return sender.id === extensionId;
}
