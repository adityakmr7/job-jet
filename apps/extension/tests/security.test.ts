import { describe, expect, it } from "vitest";
import { isExtensionMessage, isTrustedSender } from "../src/lib/messages";
import { safeDownloadFilename } from "../src/lib/download-name";

describe("message validation", () => {
  it("accepts only known message shapes", () => {
    expect(isExtensionMessage({ type: "REQUEST_FORM_FIELDS" })).toBe(true);
    expect(isExtensionMessage({ type: "OPEN_SIDE_PANEL", payload: { tabId: 1 } })).toBe(true);
    expect(isExtensionMessage({ type: "EVAL" })).toBe(false);
    expect(isExtensionMessage("REQUEST_FORM_FIELDS")).toBe(false);
    expect(isExtensionMessage(null)).toBe(false);
    expect(isExtensionMessage({ type: 42 })).toBe(false);
  });

  it("trusts only this extension's own id", () => {
    expect(isTrustedSender({ id: "abc" }, "abc")).toBe(true);
    expect(isTrustedSender({ id: "other" }, "abc")).toBe(false);
    expect(isTrustedSender({}, "abc")).toBe(false);
  });
});

describe("safeDownloadFilename", () => {
  it("keeps normal names", () => {
    expect(safeDownloadFilename("Priya Sharma - Figma.pdf")).toBe("Priya Sharma - Figma.pdf");
  });
  it("removes path traversal and reserved characters", () => {
    expect(safeDownloadFilename("../../etc/passwd")).toBe("etc-passwd.pdf");
    expect(safeDownloadFilename('A: "B" <C>?*|.pdf')).toBe("A- -B- -C-.pdf");
    expect(safeDownloadFilename("name. . .")).toBe("name.pdf");
  });
  it("falls back when nothing is left", () => {
    expect(safeDownloadFilename("...")).toBe("resume.pdf");
    expect(safeDownloadFilename("")).toBe("resume.pdf");
  });
});
