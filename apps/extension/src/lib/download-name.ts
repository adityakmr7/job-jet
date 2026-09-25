/**
 * chrome.downloads.download() rejects file names containing path
 * separators, reserved characters (<>:"|?*), control characters, leading
 * dots or trailing dots/spaces ("Invalid filename"), and a relative path
 * with ".." could otherwise escape the Downloads folder. The name comes
 * from the server (built from the user's profile name), so normalise it
 * here before handing it to Chrome.
 */
export function safeDownloadFilename(name: string, fallback = "resume.pdf"): string {
  const cleaned = name
    // eslint-disable-next-line no-control-regex -- stripping control characters is the point
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[.\s-]+/, "")
    .replace(/[.\s]+$/, "")
    .slice(0, 150)
    .trim();
  if (!cleaned) return fallback;
  return /\.pdf$/i.test(cleaned) ? cleaned : `${cleaned}.pdf`;
}
