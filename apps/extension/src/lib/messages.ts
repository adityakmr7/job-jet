/** Message contracts between content script, background, and side panel. */

export type ExtensionMessage =
  | { type: "JOB_DETECTED"; payload: { url: string; confidence: number; signals: string[] } }
  | { type: "OPEN_SIDE_PANEL"; payload: { tabId: number } }
  | { type: "REQUEST_FORM_FIELDS" }
  | { type: "FORM_FIELDS_RESULT"; payload: { fields: unknown[] } }
  | { type: "AUTOFILL_REQUEST"; payload: { values: Record<string, string> } }
  | { type: "EXTRACT_JOB_DESCRIPTION" }
  | { type: "JOB_DESCRIPTION_RESULT"; payload: { text: string; title?: string } };
