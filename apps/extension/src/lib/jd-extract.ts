/**
 * Best-effort extraction of the job description text from the current page,
 * so the user doesn't have to copy/paste it in for resume tailoring.
 */
const JD_CONTAINER_SELECTORS = [
  '[class*="job-description" i]',
  '[class*="jobdescription" i]',
  '[data-testid*="job-description" i]',
  '[id*="job-description" i]',
  "article",
  "main",
];

export function extractJobDescription(): string {
  for (const selector of JD_CONTAINER_SELECTORS) {
    const el = document.querySelector(selector);
    const text = el?.textContent?.trim();
    if (text && text.length > 200) return text.slice(0, 20000);
  }
  // Fallback: whole page text, trimmed. The backend LLM step tolerates noisy
  // input reasonably well when asked to extract the JD from it.
  return document.body?.innerText?.trim().slice(0, 20000) ?? "";
}
