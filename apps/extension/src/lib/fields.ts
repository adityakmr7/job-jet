import type { DetectedField } from "@job-jet/shared";

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
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
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

/** Collects every plausible form field on the page for mapping/autofill. */
export function collectFormFields(): DetectedField[] {
  const elements = Array.from(
    document.querySelectorAll<HTMLElement>("input, textarea, select")
  ).filter((el) => {
    if (el instanceof HTMLInputElement) {
      return !["hidden", "submit", "button", "reset", "image"].includes(el.type);
    }
    return true;
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
