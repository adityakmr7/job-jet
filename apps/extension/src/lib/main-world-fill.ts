/**
 * Writes autofill values into the page — deliberately run in the page's
 * MAIN world via `chrome.scripting.executeScript`, not from the content
 * script's isolated world.
 *
 * Found live, against a real React SPA (job-boards.greenhouse.io): the
 * content script's isolated-world `setFieldValue` (native prototype
 * setter + `el.dispatchEvent(new Event("input", {bubbles:true}))`) would
 * report success — `sendResponse({filled: 5, total: 5})`, no error — but
 * the page's actual DOM value reverted to empty moments later. The exact
 * same code, executed instead via javascript_tool in the page's own main
 * world, stuck immediately and stayed stuck. The difference isn't the
 * technique (native setter + bubbling event is the standard, correct
 * React-controlled-input workaround) — it's the world: an `Event`/`input`
 * dispatched from the isolated world is constructed from the ISOLATED
 * world's own `Event` global, a different object than the MAIN world's
 * `Event` the page's own React instance is keyed to. The DOM still
 * dispatches it (isolated and main world share one DOM), but React's
 * synthetic event plumbing — or the site's own value-tracking — doesn't
 * reliably treat it as "real" input, so the state (and therefore the
 * next re-render's DOM value) never actually updates; our direct
 * `.value` write is just painted over on the next render.
 *
 * `chrome.scripting.executeScript({world: "MAIN"})` runs the given
 * function as if it were the page's own inline `<script>` — same world
 * React itself runs in, so the dispatched events are indistinguishable
 * from real user input as far as React's event system is concerned.
 * Works for plain (non-framework) forms too, so this replaces the old
 * isolated-world AUTOFILL_REQUEST path entirely rather than keeping two.
 *
 * The injected function must be fully self-contained — it's serialized
 * and run standalone in the page, with no access to this module's other
 * imports/closures (only what's passed via `args`, structured-cloned).
 * That's why the fill logic is duplicated inline here rather than
 * imported from fields.ts.
 *
 * A second, separate wrinkle found live on this same real page:
 * `candidate-location`, `country`, and several per-job custom questions
 * (work authorization, sponsorship, discipline) aren't real `<select>`
 * elements — they're react-select comboboxes (`role="combobox"` on a
 * plain `<input>`, options rendered into a portal-mounted listbox only
 * once opened). Setting `.value` paints the visible text but never
 * registers a "selected option" in react-select's own state, so the form
 * still treats the field as unanswered. Verified live, directly against
 * this page's DOM, the actual sequence react-select needs: a real
 * `mousedown`+`focus`+`click` on the input (not just `.focus()`) to open
 * the menu, then the options render fully in the DOM (no typing/filtering
 * required, even for a 72-option list) and can be matched by their text
 * and clicked the same way.
 *
 * A third wrinkle, found testing a different real ATS (SmartRecruiters):
 * its actual fields live entirely inside open shadow roots, which plain
 * `document.querySelector` can't see across — see dom-deep.ts for the
 * full story. `queryDeep` below is that same logic duplicated inline
 * (self-contained-injected-function constraint, same reason the rest of
 * this file's logic is duplicated rather than imported).
 *
 * A fourth, found in the live portal run: Greenhouse's "Location (City)",
 * Ashby's location and Lever's "Current location" are type-to-search
 * dropdowns whose options only exist after typing (a geocoding request per
 * keystroke). Opening the menu isn't enough — `setComboboxValue` now types
 * the city with real-looking key/input events, waits for suggestions and
 * picks only an unambiguous match ("San Francisco, California, United
 * States" for a profile's "San Francisco, CA", via the `aliases` table).
 *
 * Radios/checkboxes are only ever ticked when the option's own text/value
 * matches the answer (never "check whatever got a Yes"), via a real
 * `.click()` so React/Vue state follows; Ashby's Yes/No questions are a
 * pair of buttons, clicked directly.
 *
 * `mainWorldFill` is exported (and must stay self-contained — no imports,
 * no module-level helpers) so tests can run the exact function that gets
 * injected against fixture DOM.
 */

export interface FillFile {
  name: string;
  type: string;
  /** Base64 file bytes (executeScript args must be JSON-serializable). */
  base64: string;
}

export interface FillPayload {
  values: Record<string, string>;
  /** Lowercased alias -> canonical token (e.g. "ca" -> "california"). */
  aliases?: Record<string, string>;
  /** selector -> file to attach (resume). */
  files?: Record<string, FillFile>;
  /** Max time to wait for type-to-search suggestions, ms. */
  suggestionTimeoutMs?: number;
  /** The profile's full location ("San Francisco, CA"). A city-only value
   *  ("San Francisco") is ambiguous in a location search (California, Cebu,
   *  Duarte…); when the value is a leading part of this hint, the hint is
   *  used to disambiguate the suggestion. */
  locationHint?: string;
}

export interface FillResult {
  filled: number;
  total: number;
  attached: number;
}

export async function mainWorldFill(payload: FillPayload): Promise<FillResult> {
  const values = payload.values ?? {};
  const aliases = payload.aliases ?? {};
  const files = payload.files ?? {};
  const suggestionTimeout = payload.suggestionTimeoutMs ?? 4000;
  const locationHint = (payload.locationHint ?? "").trim();
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  function queryDeep(root: ParentNode, selector: string): HTMLElement | null {
    const direct = root.querySelector<HTMLElement>(selector);
    if (direct) return direct;
    const all = root.querySelectorAll("*");
    for (const el of Array.from(all)) {
      const shadow = (el as Element).shadowRoot;
      if (shadow) {
        const found = queryDeep(shadow, selector);
        if (found) return found;
      }
    }
    return null;
  }

  const norm = (s: string | null | undefined) =>
    (s ?? "")
      .toLowerCase()
      .replace(/[*✱]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  function polarity(s: string | null | undefined): "yes" | "no" | undefined {
    const t = norm(s);
    if (/^(yes|y|true)\b/.test(t)) return "yes";
    if (/^(no|n|false)\b/.test(t)) return "no";
    return undefined;
  }

  function tokens(s: string): string[] {
    return norm(s)
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => aliases[t] ?? t);
  }

  /** Index of the one option that matches `value`, or -1 if none/ambiguous.
   *  Order: exact; Yes/No polarity ("No, I don't need a visa…"); a single
   *  option that starts with the value (remaining text has no letters, e.g.
   *  "United States +1"); location tokens ("San Francisco, CA" ->
   *  "San Francisco, California, United States"); a single substring hit. */
  function matchOption(options: string[], value: string): number {
    const target = norm(value);
    if (!target) return -1;
    const normed = options.map(norm);
    const exact = normed.indexOf(target);
    if (exact >= 0) return exact;

    const pol = polarity(target);
    if (pol && (target === "yes" || target === "no" || target === "true" || target === "false")) {
      const hits = normed.map((o, i) => (polarity(o) === pol ? i : -1)).filter((i) => i >= 0);
      return hits.length === 1 ? hits[0] : -1;
    }

    const prefix = normed
      .map((o, i) => (o.startsWith(target) && !/[a-z0-9]/.test(o.charAt(target.length)) ? i : -1))
      .filter((i) => i >= 0);
    if (prefix.length === 1) return prefix[0];
    if (prefix.length > 1) {
      const clean = prefix.filter((i) => !/[a-z]/.test(normed[i].slice(target.length)));
      if (clean.length === 1) return clean[0];
    }

    const want = tokens(value);
    if (want.length > 1) {
      const hits = normed
        .map((o, i) => {
          const have = tokens(o);
          if (have[0] !== want[0]) return -1;
          return want.every((w) => have.includes(w)) ? i : -1;
        })
        .filter((i) => i >= 0);
      if (hits.length === 1) return hits[0];
      if (hits.length > 1) return -1;
    }

    const partial = normed.map((o, i) => (o.includes(target) ? i : -1)).filter((i) => i >= 0);
    return partial.length === 1 ? partial[0] : -1;
  }

  function clickLikeUser(el: HTMLElement) {
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
    el.click();
  }

  function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
  }

  /** Types `text` the way a keyboard would, so type-to-search widgets
   *  (react-select, Ashby, Lever's location box) run their own search. */
  async function typeText(el: HTMLInputElement, text: string) {
    el.focus();
    setNativeValue(el, "");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    for (let i = 1; i <= text.length; i++) {
      const key = text[i - 1];
      el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      setNativeValue(el, text.slice(0, i));
      el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: key }));
      el.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true }));
      await wait(15);
    }
  }

  /** Options currently offered for `el`: its aria-controls listbox, or a
   *  suggestion list rendered next to it (Lever's .dropdown-results). */
  function currentOptions(el: HTMLElement): HTMLElement[] {
    const listboxId = el.getAttribute("aria-controls") || el.getAttribute("aria-owns");
    if (listboxId) {
      const listbox = document.getElementById(listboxId) ?? queryDeep(document, `#${CSS.escape(listboxId)}`);
      if (listbox) {
        const opts = Array.from(listbox.querySelectorAll<HTMLElement>('[role="option"]'));
        if (opts.length) return opts;
      }
    }
    const scope = el.closest(".application-field, .select, [class*='inputContainer'], [class*='select-shell']") ?? el.parentElement;
    if (scope) {
      const opts = Array.from(scope.querySelectorAll<HTMLElement>('[role="option"], .dropdown-results > *'));
      if (opts.length) return opts;
    }
    return [];
  }

  const isLoadingText = (opts: HTMLElement[]) =>
    opts.length === 1 && /loading|searching|no (options|results)|type to search/i.test(opts[0].textContent ?? "");

  async function pickFromSuggestions(el: HTMLElement, value: string, timeout: number): Promise<boolean> {
    const start = Date.now();
    const deadline = start + timeout;
    let lastSig = "";
    let stableTicks = 0;
    while (Date.now() < deadline) {
      const opts = currentOptions(el).filter((o) => o.getAttribute("aria-disabled") !== "true");
      if (opts.length && !isLoadingText(opts)) {
        const texts = opts.map((o) => o.textContent ?? "");
        let idx = matchOption(texts, value);
        if (idx < 0 && locationHint.length > value.length && norm(locationHint).startsWith(norm(value))) {
          idx = matchOption(texts, locationHint);
        }
        if (idx >= 0) {
          clickLikeUser(opts[idx]);
          await wait(60);
          return true;
        }
        // Results arrive in waves (debounced search, stale results for a
        // shorter prefix first — found live in Airbnb's Greenhouse embed), so
        // only give up once the list has stopped changing for a while.
        const sig = opts.map((o) => o.textContent ?? "").join("|");
        stableTicks = sig === lastSig ? stableTicks + 1 : 0;
        lastSig = sig;
        if (stableTicks >= 8 && Date.now() - start > 1500) return false;
      }
      await wait(100);
    }
    return false;
  }

  function closeMenu(el: HTMLElement) {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    el.blur();
  }

  async function setComboboxValue(el: HTMLInputElement, value: string): Promise<boolean> {
    // 1. Static option lists (react-select Yes/No, country): open the menu
    //    with a real mousedown+focus+click and pick from what's rendered.
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    el.focus();
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    for (let i = 0; i < 12; i++) {
      const opts = currentOptions(el);
      if (opts.length && !isLoadingText(opts)) {
        const idx = matchOption(
          opts.map((o) => o.textContent ?? ""),
          value
        );
        if (idx >= 0) {
          clickLikeUser(opts[idx]);
          await wait(60);
          return true;
        }
        break;
      }
      await wait(50);
    }
    // 2. Type-to-search: type the most specific leading part (the city of
    //    "San Francisco, CA") and wait for suggestions.
    const search = value.includes(",") ? value.split(",")[0].trim() : value;
    await typeText(el, search);
    if (await pickFromSuggestions(el, value, suggestionTimeout)) return true;
    // Nothing unambiguous — leave it empty rather than half-typed.
    setNativeValue(el, "");
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" }));
    closeMenu(el);
    return false;
  }

  /** Plain text inputs that are really type-to-search (Lever's location). */
  function isAutocompleteText(el: HTMLInputElement): boolean {
    return (
      el.getAttribute("aria-autocomplete") === "list" ||
      el.classList.contains("location-input") ||
      !!el.closest(".application-field")?.querySelector(".dropdown-results")
    );
  }

  function ownOptionText(el: HTMLInputElement): string {
    const root = el.getRootNode() as Document | ShadowRoot;
    const forLabel = el.id ? root.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;
    return norm(forLabel?.textContent || el.closest("label")?.textContent || el.getAttribute("aria-label") || "");
  }

  function yesNoButtons(el: HTMLElement): HTMLElement[] {
    const parent = el.parentElement;
    if (!parent) return [];
    const buttons = Array.from(parent.querySelectorAll<HTMLElement>(":scope > button"));
    const words = buttons.map((b) => norm(b.getAttribute("data-option") ?? b.textContent));
    return words.includes("yes") && words.includes("no") ? buttons : [];
  }

  async function setChoice(el: HTMLInputElement, value: string): Promise<boolean> {
    const want = polarity(value);
    const buttons = yesNoButtons(el);
    if (buttons.length) {
      if (!want) return false;
      const button = buttons.find((b) => polarity(b.getAttribute("data-option") ?? b.textContent) === want);
      if (!button) return false;
      if (button.getAttribute("aria-pressed") !== "true") clickLikeUser(button);
      await wait(30);
      return true;
    }

    const own = ownOptionText(el);
    const ownPolarity = polarity(own) ?? polarity(el.value);
    let shouldCheck: boolean;
    if (ownPolarity) {
      // A Yes/No option: only the one matching the answer.
      shouldCheck = !!want && ownPolarity === want;
    } else if (el.type === "radio") {
      // A non-Yes/No radio (e.g. "Upper-Intermediate (B1 - B2)"): only on
      // an explicit match of its own text/value.
      shouldCheck = !!own && (own === norm(value) || norm(el.value) === norm(value));
    } else {
      // A lone statement checkbox ("I am authorized to work in the US").
      shouldCheck = want === "yes" || ["1", "on", "true"].includes(norm(value)) || norm(el.value) === norm(value);
    }
    if (!shouldCheck) return false;
    if (!el.checked) {
      el.click();
      if (!el.checked) {
        // Some widgets swallow the click on the hidden input; set it directly.
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked")?.set;
        setter?.call(el, true);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
    return el.checked;
  }

  function setSelect(el: HTMLSelectElement, value: string): boolean {
    const options = Array.from(el.options);
    const byText = matchOption(
      options.map((o) => o.textContent ?? ""),
      value
    );
    const idx =
      byText >= 0
        ? byText
        : matchOption(
            options.map((o) => o.value),
            value
          );
    if (idx < 0 || options[idx].value === "") return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    if (setter) setter.call(el, options[idx].value);
    else el.value = options[idx].value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  async function setFieldValue(selector: string, value: string): Promise<boolean> {
    const el = queryDeep(document, selector);
    if (!el) return false;

    if (el instanceof HTMLInputElement && el.getAttribute("role") === "combobox") {
      return setComboboxValue(el, value);
    }
    if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
      return setChoice(el, value);
    }
    if (el instanceof HTMLInputElement && isAutocompleteText(el)) {
      const search = value.includes(",") ? value.split(",")[0].trim() : value;
      await typeText(el, search);
      if (await pickFromSuggestions(el, value, suggestionTimeout)) return true;
      // No suggestion matched: keep the full value as plain text.
      setNativeValue(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      closeMenu(el);
      return true;
    }
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      setNativeValue(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    if (el instanceof HTMLSelectElement) {
      return setSelect(el, value);
    }
    return false;
  }

  function attachFile(selector: string, file: FillFile): boolean {
    const el = queryDeep(document, selector);
    if (!(el instanceof HTMLInputElement) || el.type !== "file") return false;
    if (el.files && el.files.length > 0) return false; // never replace the user's own pick
    if (typeof DataTransfer === "undefined") return false;
    const binary = atob(file.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], file.name, { type: file.type || "application/pdf" }));
    el.files = transfer.files;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return el.files.length > 0;
  }

  const entries = Object.entries(values);
  let filled = 0;
  // Sequential, not Promise.all: each combobox interaction opens a menu and
  // waits for it to render, and two open at once would interfere.
  for (const [selector, value] of entries) {
    if (await setFieldValue(selector, value)) filled++;
  }

  // Resume last: attaching can make an ATS re-render parts of the form
  // (a filename chip replacing the input); every selector above has
  // already been used by then.
  let attached = 0;
  for (const [selector, file] of Object.entries(files)) {
    if (attachFile(selector, file)) attached++;
  }
  return { filled, total: entries.length, attached };
}

/** Runs `mainWorldFill` in the MAIN world of one frame of `tabId`. */
export async function fillFieldsInMainWorld(
  tabId: number,
  payload: FillPayload,
  frameId = 0
): Promise<FillResult> {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId, frameIds: [frameId] },
    world: "MAIN",
    func: mainWorldFill,
    args: [payload],
  });
  return (injection?.result as FillResult | undefined) ?? { filled: 0, total: 0, attached: 0 };
}
