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

/**
 * Best-effort job title guess, for labeling an application tracker entry —
 * not shown anywhere that correctness-critical, so a rough guess (falling
 * back to the page title) is an acceptable tradeoff against not guessing a
 * company name at all (too unreliable across arbitrary site layouts to be
 * worth attempting; left for the user to fill in on the tracker instead).
 */
export function extractJobTitle(): string | undefined {
  const h1 = document.querySelector("h1")?.textContent?.trim();
  if (h1 && h1.length < 150) return h1;
  const title = document.title?.trim();
  return title || undefined;
}
