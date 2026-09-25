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
 */
export async function fillFieldsInMainWorld(
  tabId: number,
  values: Record<string, string>
): Promise<{ filled: number; total: number }> {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: async (valuesArg: Record<string, string>) => {
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

      async function setComboboxValue(el: HTMLElement, value: string): Promise<boolean> {
        el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        (el as HTMLElement).focus();
        el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        el.dispatchEvent(new MouseEvent("click", { bubbles: true }));

        // Poll briefly for the listbox react-select mounts once open —
        // its id is only available via aria-controls after the click's
        // React state update has actually rendered. Check immediately
        // before the first wait (the menu is often already there by the
        // time this runs) rather than a fixed wait-then-check, and use a
        // short interval — on real pages tested this tonight, the menu
        // was consistently ready in well under 100ms, so a fixed
        // 100ms-per-attempt poll was pure added latency on every single
        // combobox on the page. Same ~1s worst-case ceiling as before,
        // much lower typical cost.
        let listbox: HTMLElement | null = null;
        for (let i = 0; i < 20 && !listbox; i++) {
          const listboxId = el.getAttribute("aria-controls");
          // document.getElementById first (fast, common — most menus
          // portal out to document.body to escape overflow/stacking
          // context, shadow DOM or not); queryDeep as a fallback for a
          // menu that stayed inside its component's own shadow root.
          listbox = listboxId
            ? document.getElementById(listboxId) ?? queryDeep(document, `#${CSS.escape(listboxId)}`)
            : null;
          if (!listbox) await wait(50);
        }
        if (!listbox) return false;

        const options = Array.from(listbox.querySelectorAll<HTMLElement>('[role="option"]'));
        const target = value.trim().toLowerCase();
        let match = options.find((o) => o.textContent?.trim().toLowerCase() === target);
        if (!match) {
          // Only accept a partial match if it's unambiguous — picking the
          // wrong one of several partial matches is worse than leaving
          // the field blank for the user to answer themselves.
          const partial = options.filter((o) => o.textContent?.toLowerCase().includes(target));
          if (partial.length === 1) match = partial[0];
        }
        if (!match) {
          (el as HTMLElement).blur();
          return false;
        }

        match.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        match.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        match.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await wait(50);
        return true;
      }

      async function setFieldValue(selector: string, value: string): Promise<boolean> {
        const el = queryDeep(document, selector);
        if (!el) return false;

        if (el.getAttribute("role") === "combobox") {
          return setComboboxValue(el, value);
        }

        if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
          const valLower = value.trim().toLowerCase();
          const shouldCheck =
            valLower === "true" ||
            valLower === "yes" ||
            valLower === "1" ||
            valLower === "on" ||
            el.value.toLowerCase() === valLower;
          const proto = HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, "checked")?.set;
          setter?.call(el, shouldCheck);
          el.dispatchEvent(new Event("change", { bubbles: true }));
          el.dispatchEvent(new Event("input", { bubbles: true }));
          return true;
        }

        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
          setter?.call(el, value);
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        }

        if (el instanceof HTMLSelectElement) {
          const target = value.trim().toLowerCase();
          const options = Array.from(el.options);
          let match = options.find(
            (o) => o.textContent?.trim().toLowerCase() === target || o.value.trim().toLowerCase() === target
          );
          if (!match) {
            const partial = options.filter(
              (o) => o.textContent?.toLowerCase().includes(target) || o.value.toLowerCase().includes(target)
            );
            if (partial.length === 1) match = partial[0];
          }
          if (match) {
            el.value = match.value;
            el.dispatchEvent(new Event("change", { bubbles: true }));
            el.dispatchEvent(new Event("input", { bubbles: true }));
            return true;
          }
          return false;
        }

        return false;
      }

      const entries = Object.entries(valuesArg);
      let filled = 0;
      // Sequential, not Promise.all: each combobox interaction opens a
      // menu and waits for it to render, and two open at once would just
      // interfere with each other on a shared page.
      for (const [selector, value] of entries) {
        if (await setFieldValue(selector, value)) filled++;
      }
      return { filled, total: entries.length };
    },
    args: [values],
  });

  return (injection?.result as { filled: number; total: number } | undefined) ?? { filled: 0, total: 0 };
}
