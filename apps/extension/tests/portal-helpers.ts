import { readFileSync } from "node:fs";
import { fileURLToPath, URL as NodeURL } from "node:url";
import { vi } from "vitest";
import type { DetectedField } from "@job-jet/shared";

const PORTALS = fileURLToPath(new NodeURL("./fixtures/portals/", import.meta.url));

/**
 * Mounts one of the trimmed live-portal DOM snapshots and replays the
 * rendered size/opacity recorded in each control's `data-snap` attribute
 * (jsdom has no layout). Elements without a snapshot measure 200×30, and
 * `data-test-size="tiny"` / inline styles still work as in fields.test.ts.
 */
export function mountPortal(name: string): void {
  const html = readFileSync(`${PORTALS}${name}.html`, "utf8");
  document.body.innerHTML = html;
  installLayoutMock();
}

export function installLayoutMock(): void {
  const snap = (el: Element) => {
    const raw = el.getAttribute("data-snap");
    if (!raw) return null;
    const m = raw.match(/^(\d+)x(\d+) op=([\d.]+)/);
    return m ? { w: Number(m[1]), h: Number(m[2]), op: m[3] } : null;
  };
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const s = snap(this);
    const tiny = this.getAttribute("data-test-size") === "tiny";
    const w = s ? s.w : tiny ? 1 : 200;
    const h = s ? s.h : tiny ? 1 : 30;
    return { width: w, height: h, top: 0, left: 0, right: w, bottom: h, x: 0, y: 0, toJSON() {} } as DOMRect;
  });
  const original = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((el: Element, pseudo?: string | null) => {
    const style = original(el, pseudo);
    const s = snap(el);
    if (!s) return style;
    return new Proxy(style, {
      get(target, prop) {
        if (prop === "opacity") return s.op;
        const value = (target as unknown as Record<string | symbol, unknown>)[prop];
        return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
      },
    });
  });
}

export function byLabel(fields: DetectedField[], re: RegExp): DetectedField {
  const f = fields.find((x) => re.test(x.question ?? x.label ?? ""));
  if (!f) throw new Error(`no field matching ${re}: ${fields.map((x) => x.label).join(" | ")}`);
  return f;
}

export function allByQuestion(fields: DetectedField[], re: RegExp): DetectedField[] {
  return fields.filter((x) => re.test(x.question ?? ""));
}
