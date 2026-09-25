import { describe, expect, it } from "vitest";
import { contentDisposition, downloadHeaders, safeContentType } from "@/lib/download";

describe("contentDisposition", () => {
  it("produces a header value the Headers API accepts for non-Latin names", () => {
    const value = contentDisposition("Résumé 履歴書.pdf");
    expect(() => new Headers({ "Content-Disposition": value })).not.toThrow();
    expect(value).toContain(`filename*=UTF-8''R%C3%A9sum%C3%A9%20%E5%B1%A5%E6%AD%B4%E6%9B%B8.pdf`);
    expect(value).toMatch(/^attachment; filename="R_sum_ ___\.pdf";/);
  });

  it("strips quotes, backslashes and control characters", () => {
    const value = contentDisposition('evil"\r\nSet-Cookie: x=1\\.pdf');
    expect(value).not.toMatch(/[\r\n]/);
    expect(value.split(";")[1]).toBe(' filename="evil_Set-Cookie: x=1_.pdf"');
    expect(() => new Headers({ "Content-Disposition": value })).not.toThrow();
  });

  it("falls back to a default name", () => {
    expect(contentDisposition("\n")).toContain('filename="resume"');
  });
});

describe("safeContentType", () => {
  it("allows only document types", () => {
    expect(safeContentType("application/pdf")).toBe("application/pdf");
    expect(safeContentType("text/plain; charset=utf-8")).toBe("text/plain");
    expect(safeContentType("text/html")).toBe("application/octet-stream");
    expect(safeContentType("image/svg+xml")).toBe("application/octet-stream");
    expect(safeContentType(undefined)).toBe("application/octet-stream");
  });

  it("downloadHeaders always sets nosniff and no-store", () => {
    const h = downloadHeaders("a.pdf", "application/pdf");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Cache-Control"]).toContain("no-store");
  });
});
