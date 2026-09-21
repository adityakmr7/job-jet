/**
 * Plain `document.querySelector`/`querySelectorAll` don't cross shadow
 * DOM boundaries — found live, testing against a real ATS: SmartRecruiters'
 * "Easy Apply" widget renders its actual `<input>` elements entirely
 * inside OPEN shadow roots (confirmed directly: 14 real fields on the
 * page, 0 found by a plain top-level query, all 14 found once the query
 * explicitly stepped into each shadow root). Without this, the extension
 * is silently blind to any site built this way — not "detects 0 fields
 * and says so", genuinely unable to see the fields exist at all.
 *
 * These helpers recurse into every open shadow root reachable from a
 * given starting point, so field detection, label lookup, and
 * selector-based resolution at fill-time all work the same whether a
 * site uses shadow DOM or not.
 *
 * Closed shadow roots are a hard, unfixable limit, not a bug here:
 * `element.shadowRoot` returns `null` for them by design — true
 * encapsulation is the entire point of "closed" mode, no outside script
 * can reach in regardless of technique. Every real site found and tested
 * so far (including SmartRecruiters) uses open mode.
 */

export function queryAllDeep(root: ParentNode, selector: string): Element[] {
  const results: Element[] = Array.from(root.querySelectorAll(selector));
  const all = root.querySelectorAll("*");
  for (const el of Array.from(all)) {
    const shadow = (el as Element).shadowRoot;
    if (shadow) results.push(...queryAllDeep(shadow, selector));
  }
  return results;
}

export function queryDeep(root: ParentNode, selector: string): Element | null {
  const direct = root.querySelector(selector);
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
