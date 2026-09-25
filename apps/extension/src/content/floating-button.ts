/**
 * Injects the floating "Job Jet" launcher into a *closed* shadow root so
 * the host page's CSS can never clash with (or override) our styling and
 * page scripts can't reach into it. `:host { all: initial }` also stops
 * inherited properties (font, color, line-height…) leaking in from the page.
 */

const HOST_ID = "job-jet-floating-root";
const SVG_NS = "http://www.w3.org/2000/svg";

let dismissedForPage = false;

function svg(tag: string, attrs: Record<string, string>, children: SVGElement[] = []): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const c of children) el.appendChild(c);
  return el;
}

/** The Job Jet mark, built with DOM APIs (no innerHTML on host pages). */
function logoMark(): SVGElement {
  const stroke = { fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" };
  return svg("svg", { viewBox: "0 0 128 128", width: "22", height: "22", "aria-hidden": "true" }, [
    svg("rect", { x: "4", y: "4", width: "120", height: "120", rx: "30", fill: "#ffffff", "fill-opacity": "0.16" }),
    svg("path", { d: "M34 60 H56", stroke: "#ffb08f", "stroke-width": "10", ...stroke }),
    svg("path", { d: "M80 34 V80 C80 94 71 102 58 102 C49 102 43 98 40 92", stroke: "#fff", "stroke-width": "14", ...stroke }),
    svg("path", { d: "M63 46 L80 28 L97 46", stroke: "#fff", "stroke-width": "14", ...stroke }),
  ]);
}

const STYLES = `
  :host { all: initial; }
  .wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    font: 600 14px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    animation: enter 0.25s ease-out;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 44px;
    padding: 0 18px 0 12px;
    border-radius: 999px;
    border: none;
    background: linear-gradient(135deg, #4557f0, #2536c4);
    color: #fff;
    font: inherit;
    letter-spacing: -0.005em;
    cursor: pointer;
    box-shadow: 0 10px 28px -8px rgba(37, 54, 196, 0.65), 0 2px 6px rgba(14, 19, 48, 0.2);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  .btn:hover { transform: translateY(-2px); box-shadow: 0 14px 32px -8px rgba(37, 54, 196, 0.7), 0 2px 6px rgba(14, 19, 48, 0.2); }
  .btn:active { transform: translateY(0) scale(0.98); }
  .btn:focus-visible, .close:focus-visible { outline: 3px solid #f2622e; outline-offset: 2px; }
  .close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    border: 1px solid rgba(14, 19, 48, 0.12);
    background: #fff;
    color: #555c78;
    font: 500 16px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s ease;
    box-shadow: 0 2px 6px rgba(14, 19, 48, 0.12);
  }
  .wrap:hover .close, .close:focus-visible { opacity: 1; }
  @keyframes enter { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { .wrap { animation: none; } .btn { transition: none; } }
`;

export function mountFloatingButton(onClick: () => void): void {
  if (dismissedForPage || document.getElementById(HOST_ID)) return;

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.position = "fixed";
  host.style.zIndex = "2147483647"; // max z-index, sits above everything
  host.style.bottom = "24px";
  host.style.right = "24px";
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = STYLES;

  const wrap = document.createElement("div");
  wrap.className = "wrap";

  const close = document.createElement("button");
  close.className = "close";
  close.type = "button";
  close.setAttribute("aria-label", "Hide Job Jet on this page");
  close.textContent = "×";
  close.addEventListener("click", () => {
    dismissedForPage = true;
    unmountFloatingButton();
  });

  const button = document.createElement("button");
  button.className = "btn";
  button.type = "button";
  button.setAttribute("aria-label", "Open Job Jet to autofill this application");
  const label = document.createElement("span");
  label.textContent = "Autofill with Job Jet";
  button.append(logoMark(), label);
  button.addEventListener("click", onClick);

  wrap.append(close, button);
  shadow.append(style, wrap);
}

export function unmountFloatingButton(): void {
  document.getElementById(HOST_ID)?.remove();
}

/** Test hook: forget a "hide on this page" dismissal. */
export function resetFloatingButtonDismissal(): void {
  dismissedForPage = false;
}
