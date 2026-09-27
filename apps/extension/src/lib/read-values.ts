import type { DetectedField } from "@job-jet/shared";
import { NEVER_FILL, matches } from "./autofill-map";

/**
 * "Save this answer": after an autofill, the questions Job Jet couldn't
 * answer are offered back to the user once they've typed their own
 * answers on the page, so the next form fills them automatically.
 */

/** Unfilled free-text/select questions worth offering to save: labelled,
 *  not files/choices, not a voluntary disclosure (those are set on the
 *  Profile page on purpose), not already filled by Job Jet. */
export function questionsLeftForUser(fields: DetectedField[], filledSelectors: Set<string>): DetectedField[] {
  const seen = new Set<string>();
  return fields.filter((f) => {
    if (filledSelectors.has(f.selector)) return false;
    if (!["text", "textarea", "select", "search", "number"].includes(f.type)) return false;
    const q = (f.question ?? f.label ?? "").trim();
    if (q.length < 3 || q.length > 200) return false;
    if (matches(f, NEVER_FILL)) return false;
    // Contact details and links belong in the profile itself.
    if (/e-?mail|phone|mobile|linkedin|github|website|portfolio|url|\bname\b|address|zip|postal|password/i.test(q))
      return false;
    const key = `${f.frameId ?? 0}:${q.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Runs in the page (chrome.scripting.executeScript, isolated world — only
 * reading): the current answer for each selector. Selects give the chosen
 * option's text; type-to-search comboboxes (react-select) the rendered
 * selection. Self-contained because it's serialized into the page.
 */
export function readValuesInPage(selectors: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const selector of selectors) {
    let el: Element | null = null;
    try {
      el = document.querySelector(selector);
    } catch {
      el = null;
    }
    if (!el) continue;
    let value = "";
    if (el instanceof HTMLSelectElement) {
      const opt = el.selectedOptions[0];
      value = opt && opt.value !== "" ? (opt.textContent ?? "") : "";
    } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      value = el.value;
      if (!value && el.getAttribute("role") === "combobox") {
        const container = el.closest(
          "[class*='select__control'], [class*='select-shell'], .select, [class*='container']"
        );
        const chosen = container?.querySelector("[class*='single-value'], [class*='singleValue']");
        value = chosen?.textContent ?? "";
      }
    }
    value = value.replace(/\s+\n/g, "\n").trim();
    if (value && value.length <= 2000) out[selector] = value;
  }
  return out;
}
