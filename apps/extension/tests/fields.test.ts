import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { collectFormFields } from "../src/lib/fields";
import { queryAllDeep, queryDeep } from "../src/lib/dom-deep";
import { mountFixture } from "./helpers";

// jsdom has no layout: every element measures 0x0, which the honeypot
// filter would treat as hidden. Give elements a realistic size unless a
// test opts an element out via data-test-size="tiny".
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const tiny = this.getAttribute("data-test-size") === "tiny";
    const size = tiny ? 1 : 200;
    return { width: size, height: tiny ? 1 : 30, top: 0, left: 0, right: size, bottom: 30, x: 0, y: 0, toJSON() {} } as DOMRect;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("collectFormFields", () => {
  it("collects every fillable field from the fixture form with labels and options", () => {
    mountFixture("careers/senior-frontend-engineer/apply/index.html");
    const fields = collectFormFields();

    const byId = Object.fromEntries(fields.map((f) => [f.id, f]));
    expect(byId.firstName).toMatchObject({ label: "First Name", name: "firstName", type: "text", placeholder: "Jane" });
    expect(byId.email.type).toBe("email");
    expect(byId.phone.type).toBe("tel");
    expect(byId.resume.type).toBe("file");
    expect(byId.coverLetter.type).toBe("textarea");
    expect(byId.workAuthorization.type).toBe("select");
    expect(byId.workAuthorization.options?.length).toBeGreaterThan(1);
    // No submit/hidden inputs
    expect(fields.every((f) => !["submit", "hidden", "button"].includes(f.type))).toBe(true);
  });

  it("assigns stable data-jobjet-id selectors that resolve back to the element", () => {
    mountFixture("careers/senior-frontend-engineer/apply/index.html");
    const first = collectFormFields();
    const second = collectFormFields();
    expect(second.map((f) => f.selector)).toEqual(first.map((f) => f.selector));
    const email = first.find((f) => f.id === "email")!;
    expect(document.querySelector(email.selector)?.getAttribute("id")).toBe("email");
  });

  it("excludes honeypot fields (hidden or ~1px)", () => {
    document.body.innerHTML = `
      <label for="real">Name</label><input id="real" name="name" />
      <input id="tiny" name="website" data-test-size="tiny" />
      <input id="invisible" name="url" style="visibility:hidden" />
      <input id="gone" name="x" style="display:none" />
      <input type="hidden" name="csrf" />`;
    expect(collectFormFields().map((f) => f.id)).toEqual(["real"]);
  });

  it("falls back to wrapping label, aria-label, then container text", () => {
    document.body.innerHTML = `
      <label>Wrapped label <input name="a" /></label>
      <input name="b" aria-label="Aria label" />
      <div>Container text <input name="c" /></div>`;
    const labels = collectFormFields().map((f) => f.label);
    expect(labels).toEqual(["Wrapped label", "Aria label", "Container text"]);
  });

  it("finds fields inside open shadow roots", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<label for="sh">Shadow email</label><input id="sh" type="email" />`;

    const fields = collectFormFields();
    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({ id: "sh", type: "email", label: "Shadow email" });
    expect(queryDeep(document, fields[0].selector)).toBe(shadow.querySelector("#sh"));
  });
});

describe("dom-deep", () => {
  it("queryAllDeep recurses into nested open shadow roots", () => {
    document.body.innerHTML = `<input id="top" />`;
    const outer = document.createElement("div");
    document.body.appendChild(outer);
    const outerShadow = outer.attachShadow({ mode: "open" });
    outerShadow.innerHTML = `<input id="mid" /><div id="inner-host"></div>`;
    const innerShadow = outerShadow.getElementById("inner-host")!.attachShadow({ mode: "open" });
    innerShadow.innerHTML = `<input id="deep" />`;

    expect(queryAllDeep(document, "input").map((el) => el.id)).toEqual(["top", "mid", "deep"]);
    expect(queryDeep(document, "#deep")?.id).toBe("deep");
    expect(queryDeep(document, "#missing")).toBeNull();
  });
});
