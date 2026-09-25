/**
 * Response headers for serving a stored resume file back to its owner.
 *
 * - Content-Disposition: the stored file name is user-controlled (the
 *   original upload's name, or the profile name for tailored PDFs). It's
 *   emitted as an ASCII-only `filename` fallback plus an RFC 5987
 *   `filename*` so non-Latin names ("Résumé", "履歴書") don't make the
 *   Headers constructor throw, and quotes/CR/LF can't break out of the
 *   header value.
 * - Content-Type: only a small allow-list of document types is echoed back
 *   (the stored type comes from the uploader); anything else is served as
 *   application/octet-stream, and nosniff stops the browser from guessing.
 */

const SAFE_CONTENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

export function safeContentType(stored: string | null | undefined): string {
  const base = (stored ?? "").split(";")[0].trim().toLowerCase();
  return SAFE_CONTENT_TYPES.has(base) ? base : "application/octet-stream";
}

export function contentDisposition(fileName: string): string {
  const cleaned = fileName.replace(/[\u0000-\u001f\u007f]/g, "").trim() || "resume";
  const asciiFallback = cleaned.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(cleaned).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

export function downloadHeaders(fileName: string, storedContentType: string | null | undefined): Record<string, string> {
  return {
    "Content-Type": safeContentType(storedContentType),
    "Content-Disposition": contentDisposition(fileName),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  };
}
