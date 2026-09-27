import type { DetectedField } from "@job-jet/shared";
import { queryAllDeep } from "./dom-deep";

let counter = 0;

/** Fields in an embedded (iframe) application form get a per-document
 *  prefix so their selectors can never collide with the top document's
 *  when the side panel merges both frames' fields into one list. */
const FRAME_PREFIX = (() => {
  try {
    return window.top === window ? "" : `f${Math.random().toString(36).slice(2, 7)}-`;
  } catch {
    return `f${Math.random().toString(36).slice(2, 7)}-`;
  }
})();

/** Ensures every candidate field has a stable hook we can select it by later. */
function ensureSelector(el: HTMLElement): string {
  const existing = el.getAttribute("data-jobjet-id");
  if (existing) return `[data-jobjet-id="${existing}"]`;
  const id = `jj-${FRAME_PREFIX}${counter++}`;
  el.setAttribute("data-jobjet-id", id);
  return `[data-jobjet-id="${id}"]`;
}

const MAX_LABEL = 300;
const FIELD_SELECTOR = "input, textarea, select";
const CHOICE_TYPES = new Set(["radio", "checkbox"]);

/** Visible text of a node — skipping <svg>/<title>/<script>/<style> (found
 *  live on Workable: an inline SVG's fallback "SVGs not supported by this
 *  browser." became a field's label) and the text of any nested form
 *  control (a <select>'s options would otherwise leak into its label). */
export function visibleText(node: Node | null | undefined): string {
  if (!node) return "";
  let out = "";
  const walk = (n: Node) => {
    if (n.nodeType === Node.TEXT_NODE) {
      out += n.textContent ?? "";
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    const el = n as Element;
    const tag = el.tagName.toLowerCase();
    if (["svg", "title", "script", "style", "noscript", "select", "option", "textarea", "button"].includes(tag)) return;
    for (const child of Array.from(el.childNodes)) walk(child);
    out += " ";
  };
  walk(node);
  return cleanLabel(out);
}

function cleanLabel(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/[*✱]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_LABEL);
}

function rootOf(el: Element): Document | ShadowRoot {
  return el.getRootNode() as Document | ShadowRoot;
}

function byId(el: Element, id: string): Element | null {
  const root = rootOf(el) as (Document | ShadowRoot) & { getElementById?: (id: string) => Element | null };
  // Document and ShadowRoot (a DocumentFragment) both have getElementById —
  // no selector escaping needed for ids like Ashby's "1b9bad34-…" or
  // Greenhouse's "question_123[]".
  if (typeof root.getElementById === "function") return root.getElementById(id);
  return Array.from(root.querySelectorAll("[id]")).find((n) => n.id === id) ?? null;
}

/** `label[for=id]` in the element's own root, without building a selector
 *  from the (page-controlled) id. */
function labelElementFor(el: Element, id: string): Element | null {
  return Array.from(rootOf(el).querySelectorAll("label[for]")).find((l) => l.getAttribute("for") === id) ?? null;
}

function ariaLabelledByText(el: Element): string | undefined {
  const ids = el.getAttribute("aria-labelledby");
  if (!ids) return undefined;
  const text = ids
    .split(/\s+/)
    .map((id) => visibleText(byId(el, id)))
    .filter(Boolean)
    .join(" ");
  return cleanLabel(text) || undefined;
}

function labelForAttr(el: Element): string | undefined {
  const id = el.getAttribute("id");
  if (!id) return undefined;
  // Scoped to the element's own root (its shadow root if it's in one).
  return visibleText(labelElementFor(el, id)) || undefined;
}

function isField(el: Element): boolean {
  if (!el.matches(FIELD_SELECTOR)) return false;
  return !(el instanceof HTMLInputElement && el.type === "hidden");
}

/** The "question title" element of a field's container, found by walking up
 *  from the field until an ancestor holds a label-ish element that comes
 *  BEFORE the field — stopping as soon as an ancestor would also contain a
 *  different question's field (so a neighbour's label is never borrowed).
 *  Covers the real layouts found live:
 *   - Ashby: `label.ashby-application-form-question-title[for=<not the input's id>]`
 *   - Lever custom cards: `.application-question > .application-label`
 *   - Workable: `<span id="x_label"><strong>Question</strong></span>`
 *   - Greenhouse: `label.label` / fieldset `legend`. */
const TITLE_SELECTOR = [
  "legend",
  "label",
  ".application-label",
  "[class*='question-title']",
  "[class*='questionTitle']",
  "[class*='label']",
  "[id$='_label']",
  "[id$='-label']",
].join(", ");

function sameGroup(a: Element, b: Element): boolean {
  if (a === b) return true;
  if (a instanceof HTMLInputElement && b instanceof HTMLInputElement) {
    if (CHOICE_TYPES.has(a.type) && CHOICE_TYPES.has(b.type)) {
      return !!a.name && a.name === b.name;
    }
  }
  return false;
}

function questionTitle(el: HTMLElement, groupAware: boolean): string | undefined {
  let node: HTMLElement | null = el.parentElement;
  for (let depth = 0; node && depth < 7; depth++, node = node.parentElement) {
    if (node.tagName === "FORM" || node.tagName === "BODY") break;
    const otherFields = Array.from(node.querySelectorAll(FIELD_SELECTOR)).filter(
      (f) => isField(f) && !sameGroup(f, el) && !(groupAware && isChoiceInSameContainer(f, el, node!))
    );
    if (otherFields.length > 0) break;
    const titles = Array.from(node.querySelectorAll(TITLE_SELECTOR)).filter((t) => {
      if (t.contains(el)) return false;
      if (t.querySelector(FIELD_SELECTOR)) return false;
      // Must precede the field in document order.
      return !!(t.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    // A choice option's own label (Lever's "<label><input>Yes</label>")
    // isn't the question — skip labels that wrap/are-for a choice input.
    const questionTitles = titles.filter((t) => !isOptionLabel(t));
    for (let i = questionTitles.length - 1; i >= 0; i--) {
      const text = visibleText(questionTitles[i]);
      if (text) return text;
    }
  }
  return undefined;
}

/** For a Yes/No checkbox group ("Do you have the unrestricted right to work
 *  in Canada?" with a Yes and a No checkbox, each with its own name), the
 *  sibling options aren't "other fields". Treats choice inputs inside the
 *  same list/fieldset as one group. */
function isChoiceInSameContainer(f: Element, el: HTMLElement, container: Element): boolean {
  if (!(f instanceof HTMLInputElement) || !CHOICE_TYPES.has(f.type) || !CHOICE_TYPES.has((el as HTMLInputElement).type)) {
    return false;
  }
  const group = el.closest("ul, fieldset, [role='radiogroup'], [role='group']");
  return !!group && container.contains(group) && group.contains(f);
}

function isOptionLabel(t: Element): boolean {
  if (t.tagName !== "LABEL") return false;
  const forId = t.getAttribute("for");
  if (forId) {
    const target = byId(t, forId);
    if (target instanceof HTMLInputElement && CHOICE_TYPES.has(target.type)) return true;
  }
  return false;
}

/** The option text of a radio/checkbox: its own label, not the question. */
function optionLabel(el: HTMLInputElement): string | undefined {
  const forLabel = labelForAttr(el);
  if (forLabel) return forLabel;
  const wrapping = el.closest("label");
  const wrapText = visibleText(wrapping);
  if (wrapText) return wrapText;
  const aria = el.getAttribute("aria-label");
  if (aria) return cleanLabel(aria);
  return undefined;
}

/** The question a radio/checkbox belongs to. */
function groupQuestion(el: HTMLInputElement): string | undefined {
  const fieldset = el.closest("fieldset");
  if (fieldset) {
    const labelled = ariaLabelledByText(fieldset);
    if (labelled) return labelled;
    const legend = fieldset.querySelector(":scope > legend");
    const legendText = visibleText(legend);
    if (legendText) return legendText;
  }
  const group = el.closest("[role='radiogroup'], [role='group']");
  if (group) {
    const labelled = ariaLabelledByText(group) ?? (group.getAttribute("aria-label") ? cleanLabel(group.getAttribute("aria-label")!) : undefined);
    if (labelled) return labelled;
  }
  const leverQuestion = el.closest(".application-question");
  if (leverQuestion) {
    const text = visibleText(leverQuestion.querySelector(".application-label"));
    if (text) return text;
  }
  return questionTitle(el, true);
}

/** Ashby renders Yes/No questions as two <button data-option> plus a
 *  visually-hidden checkbox that only mirrors the choice. */
export function yesNoButtonGroup(el: Element): Element | null {
  const parent = el.parentElement;
  if (!parent) return null;
  const buttons = Array.from(parent.querySelectorAll(":scope > button"));
  if (buttons.length < 2) return null;
  const words = buttons.map((b) => (b.getAttribute("data-option") ?? b.textContent ?? "").trim().toLowerCase());
  return words.includes("yes") && words.includes("no") ? parent : null;
}

function labelFor(el: HTMLElement): string | undefined {
  const labelled = ariaLabelledByText(el);
  if (labelled) return labelled;
  const forLabel = labelForAttr(el);
  if (forLabel) return forLabel;
  // A wrapping <label> — but prefer its question-title child when there is
  // one (Lever wraps the whole row, dropdown helper text included).
  const wrapping = el.closest("label");
  if (wrapping) {
    const title = wrapping.querySelector(".application-label, [class*='label']:not(input)");
    const text = visibleText(title) || visibleText(wrapping);
    if (text) return text;
  }
  const aria = el.getAttribute("aria-label");
  if (aria) return cleanLabel(aria);
  const title = questionTitle(el, false);
  if (title) return title;
  // Last resort: the text of the nearest container that holds only this field.
  const container = el.closest("div, li, fieldset");
  if (container && Array.from(container.querySelectorAll(FIELD_SELECTOR)).filter(isField).length === 1) {
    const text = visibleText(container).slice(0, 120);
    if (text) return text;
  }
  return undefined;
}

function isHidden(el: Element): boolean {
  const style = getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return true;
  const rect = el.getBoundingClientRect();
  return rect.width <= 2 || rect.height <= 2;
}

function isRendered(el: Element | null): boolean {
  if (!el) return false;
  const style = getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 2 && rect.height > 2;
}

/** Anti-bot honeypot fields are a real thing on real ATS forms — found
 *  live on a Workday application: a field named "website" (which our own
 *  portfolio-matching heuristic would happily fill), styled to a literal
 *  1px × 1px box. Invisible to a real applicant, but present in the DOM
 *  for a naive script to blindly fill. Text-like fields that small or
 *  invisible are excluded entirely (never offered to any tier).
 *
 *  Custom-styled checkboxes/radios are the exception, found live on
 *  Ashby, Workable and Greenhouse: the real <input> is opacity 0 / 0×0 and
 *  a styled label, wrapper or Yes/No button is what the applicant sees and
 *  clicks. Those are kept when that visible stand-in exists — a honeypot
 *  checkbox has no visible label to click. File inputs are always hidden
 *  behind an "Attach" button and can't be bot-filled anyway, so they're
 *  kept too (the resume attach step decides whether to touch them). */
function isLikelyHoneypot(el: HTMLElement): boolean {
  if (el instanceof HTMLInputElement && el.type === "file") return false;
  if (!isHidden(el)) return false;
  if (el instanceof HTMLInputElement && CHOICE_TYPES.has(el.type)) {
    return !hasVisibleStandIn(el);
  }
  return true;
}

function hasVisibleStandIn(el: HTMLInputElement): boolean {
  const id = el.getAttribute("id");
  if (id) {
    const forLabel = labelElementFor(el, id);
    if (isRendered(forLabel) && visibleText(forLabel)) return true;
  }
  const wrapping = el.closest("label");
  if (isRendered(wrapping) && visibleText(wrapping)) return true;
  const ariaWrapper = el.closest("[role='radio'], [role='checkbox']");
  if (isRendered(ariaWrapper)) return true;
  const buttons = yesNoButtonGroup(el);
  if (buttons && Array.from(buttons.querySelectorAll(":scope > button")).some(isRendered)) return true;
  return false;
}

/** For a <select>, the empty-valued first option is often where the real
 *  question lives (Lever: label "Visa permission", first option "Do you
 *  need a visa or work permit to work in the chosen location?"). */
function selectPlaceholder(el: HTMLSelectElement): string | undefined {
  const first = el.options[0];
  if (!first || first.value !== "") return undefined;
  const text = cleanLabel(first.textContent ?? "");
  return text && !/^(select|choose|please select|--)/i.test(text) ? text : undefined;
}

/** Collects every plausible form field on the page for mapping/autofill —
 *  including ones nested inside open shadow roots (queryAllDeep), see
 *  dom-deep.ts for why that's not optional. */
export function collectFormFields(): DetectedField[] {
  const elements = (queryAllDeep(document, FIELD_SELECTOR) as HTMLElement[]).filter((el) => {
    if (el instanceof HTMLInputElement) {
      if (["hidden", "submit", "button", "reset", "image", "password"].includes(el.type)) return false;
    }
    return !isLikelyHoneypot(el);
  });

  return elements.map((el) => {
    const selector = ensureSelector(el);
    const base = {
      selector,
      name: el.getAttribute("name") ?? undefined,
      id: el.getAttribute("id") ?? undefined,
      placeholder: el.getAttribute("placeholder") ?? undefined,
    };

    if (el instanceof HTMLSelectElement) {
      return {
        ...base,
        label: labelFor(el),
        placeholder: base.placeholder ?? selectPlaceholder(el),
        type: "select",
        options: Array.from(el.options).map((o) => o.textContent?.trim() ?? ""),
      };
    }
    if (el instanceof HTMLTextAreaElement) {
      return { ...base, label: labelFor(el), type: "textarea" };
    }

    const input = el as HTMLInputElement;
    if (CHOICE_TYPES.has(input.type)) {
      if (yesNoButtonGroup(input)) {
        const question = groupQuestion(input);
        return { ...base, label: question, question, type: "yesno", options: ["Yes", "No"] };
      }
      const question = groupQuestion(input);
      const option = optionLabel(input) ?? (input.value && input.value !== "on" ? input.value : undefined);
      return { ...base, label: option ?? question, question: question !== option ? question : undefined, type: input.type };
    }
    return { ...base, label: labelFor(el), type: input.type || "text" };
  });
}

// setFieldValue used to live here, called via a content-script message
// (isolated world). Moved to main-world-fill.ts and now runs via
// chrome.scripting.executeScript({world: "MAIN"}) instead — found live,
// against a real React SPA, that isolated-world event dispatch silently
// doesn't stick (the write appears to succeed, then reverts on next
// render). See main-world-fill.ts's doc comment for the full story.
