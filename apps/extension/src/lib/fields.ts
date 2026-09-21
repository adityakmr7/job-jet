import type { DetectedField } from "@job-jet/shared";
import { queryAllDeep } from "./dom-deep";

let counter = 0;

/** Ensures every candidate field has a stable hook we can select it by later. */
function ensureSelector(el: HTMLElement): string {
  const existing = el.getAttribute("data-jobjet-id");
  if (existing) return `[data-jobjet-id="${existing}"]`;
  const id = `jj-${counter++}`;
  el.setAttribute("data-jobjet-id", id);
  return `[data-jobjet-id="${id}"]`;
}

function labelFor(el: HTMLElement): string | undefined {
  const id = el.getAttribute("id");
  if (id) {
    // Scoped to the element's own root (its shadow root if it's in one,
    // the document otherwise) via getRootNode() — a label[for] pairing
    // lives in the same root as its input in every real component found
    // so far, and a plain top-level document.querySelector wouldn't find
    // it if that root is a shadow root.
    const root = el.getRootNode() as Document | ShadowRoot;
    const label = root.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (label?.textContent) return label.textContent.trim();
  }
  const closestLabel = el.closest("label");
  if (closestLabel?.textContent) return closestLabel.textContent.trim();
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel.trim();
  // Fall back to the nearest preceding text node within a common container.
  const container = el.closest("div, li, fieldset");
  const text = container?.textContent?.trim().slice(0, 120);
  return text || undefined;
}

/** Anti-bot honeypot fields are a real thing on real ATS forms — found
 *  live on a Workday application: a field named "website" (which our own
 *  portfolio-matching heuristic would happily fill), styled to a literal
 *  1px × 1px box. Invisible to a real applicant, but present in the DOM
 *  for a naive script to blindly fill — exactly the signal a real ATS's
 *  bot detection is built to catch, on a REAL application a real person
 *  is submitting. No legitimate field a user is meant to fill is ever
 *  this small, so excluding near-zero-size/hidden fields entirely (never
 *  even offered to any tier — heuristic, adapter, or LLM) is a safe,
 *  low-risk trade. */
function isLikelyHoneypot(el: HTMLElement): boolean {
  const style = getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return true;
  const rect = el.getBoundingClientRect();
  return rect.width <= 2 || rect.height <= 2;
}

/** Collects every plausible form field on the page for mapping/autofill —
 *  including ones nested inside open shadow roots (queryAllDeep), see
 *  dom-deep.ts for why that's not optional. */
export function collectFormFields(): DetectedField[] {
  const elements = (queryAllDeep(document, "input, textarea, select") as HTMLElement[]).filter((el) => {
    if (el instanceof HTMLInputElement) {
      if (["hidden", "submit", "button", "reset", "image"].includes(el.type)) return false;
    }
    return !isLikelyHoneypot(el);
  });

  return elements.map((el) => {
    const selector = ensureSelector(el);
    const type =
      el instanceof HTMLSelectElement
        ? "select"
        : el instanceof HTMLTextAreaElement
        ? "textarea"
        : (el as HTMLInputElement).type || "text";

    const options =
      el instanceof HTMLSelectElement
        ? Array.from(el.options).map((o) => o.textContent?.trim() ?? "")
        : undefined;

    return {
      selector,
      label: labelFor(el),
      name: el.getAttribute("name") ?? undefined,
      id: el.getAttribute("id") ?? undefined,
      placeholder: el.getAttribute("placeholder") ?? undefined,
      type,
      options,
    };
  });
}

// setFieldValue used to live here, called via a content-script message
// (isolated world). Moved to main-world-fill.ts and now runs via
// chrome.scripting.executeScript({world: "MAIN"}) instead — found live,
// against a real React SPA, that isolated-world event dispatch silently
// doesn't stick (the write appears to succeed, then reverts on next
// render). See main-world-fill.ts's doc comment for the full story.
