// jsdom gaps the extension code relies on in real Chrome.

// HTMLElement.innerText isn't implemented by jsdom; textContent is a close
// enough stand-in for keyword detection.
if (!("innerText" in HTMLElement.prototype)) {
  Object.defineProperty(HTMLElement.prototype, "innerText", {
    get(this: HTMLElement) {
      return this.textContent ?? "";
    },
    configurable: true,
  });
}

// CSS.escape is used to build label[for="..."] selectors.
const g = globalThis as unknown as { CSS?: { escape?: (s: string) => string } };
if (!g.CSS?.escape) {
  g.CSS = {
    ...(g.CSS ?? {}),
    escape: (value: string) => value.replace(/([^\w-])/g, "\\$1"),
  };
}
