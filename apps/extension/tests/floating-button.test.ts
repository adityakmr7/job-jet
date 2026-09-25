import { afterEach, describe, expect, it, vi } from "vitest";
import { mountFloatingButton, resetFloatingButtonDismissal, unmountFloatingButton } from "../src/content/floating-button";

afterEach(() => {
  unmountFloatingButton();
  resetFloatingButtonDismissal();
});

describe("floating button", () => {
  it("mounts once, in a closed shadow root", () => {
    mountFloatingButton(() => {});
    mountFloatingButton(() => {});
    const hosts = document.querySelectorAll("#job-jet-floating-root");
    expect(hosts).toHaveLength(1);
    // Closed: page scripts can't reach the button through the host.
    expect((hosts[0] as HTMLElement).shadowRoot).toBeNull();
  });

  it("unmounts", () => {
    mountFloatingButton(() => {});
    unmountFloatingButton();
    expect(document.getElementById("job-jet-floating-root")).toBeNull();
  });

  it("wires the click handler and supports dismissing for the page", () => {
    const onClick = vi.fn();
    const attach = vi.spyOn(HTMLElement.prototype, "attachShadow");
    mountFloatingButton(onClick);
    const root = attach.mock.results[0].value as ShadowRoot;
    attach.mockRestore();

    root.querySelector<HTMLButtonElement>(".btn")!.click();
    expect(onClick).toHaveBeenCalledOnce();

    root.querySelector<HTMLButtonElement>(".close")!.click();
    expect(document.getElementById("job-jet-floating-root")).toBeNull();
    mountFloatingButton(onClick);
    expect(document.getElementById("job-jet-floating-root")).toBeNull();
  });
});
