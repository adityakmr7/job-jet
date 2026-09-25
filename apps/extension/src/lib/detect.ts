/**
 * Job-application-page detector.
 *
 * Strategy: a fast-path hostname allowlist for known ATSs (cheap, near-zero
 * false positives) OR'd with a generic content/DOM heuristic score so we
 * also catch bespoke company career pages and ATSs we've never seen before.
 * Runs on `document_idle` and again on SPA route changes (job boards are
 * almost all client-side routed).
 */

import { queryAllDeep } from "./dom-deep";

// Known ATS hostnames — fast path, skips scoring entirely.
const KNOWN_ATS_HOSTS = [
  "greenhouse.io",
  "boards.greenhouse.io",
  "job-boards.greenhouse.io",
  "lever.co",
  "jobs.lever.co",
  "myworkdayjobs.com",
  "myworkdaysite.com",
  "ashbyhq.com",
  "jobs.ashbyhq.com",
  "icims.com",
  "smartrecruiters.com",
  "jobvite.com",
  "workable.com",
  "apply.workable.com",
  "bamboohr.com",
  "taleo.net",
  "linkedin.com",
  "successfactors.com",
  "breezy.hr",
  "recruitee.com",
  "personio.de",
  "personio.com",
];

// Job Jet's own web app is never a job application, even though its
// dashboard genuinely has real form fields and a file upload (the profile
// editor + resume uploader) — enough "form evidence" to otherwise pass the
// heuristic below. Found by dogfooding: the floating button was showing
// up on our own dashboard. Matched by host (hostname:port), not just
// hostname — localhost also serves the test fixtures (port 4000), which
// must NOT be excluded, they're meant to be detected.
// TODO: add the production domain (hostname only, no port) once deployed.
const OWN_APP_HOSTS = ["localhost:3001", "127.0.0.1:3001"];

const URL_KEYWORDS = ["job", "career", "apply", "position", "opening", "vacanc"];

const PAGE_TEXT_KEYWORDS = [
  "apply now",
  "job description",
  "cover letter",
  "resume",
  "cv",
  "work authorization",
  "sponsorship",
  "equal opportunity employer",
  "years of experience",
];

// Field name/id/label fragments strongly associated with job applications.
const FIELD_KEYWORDS = [
  "first.?name",
  "last.?name",
  "full.?name",
  "resume",
  "cv",
  "cover.?letter",
  "linkedin",
  "portfolio",
  "work.?authoriz",
  "authoriz.*work",
  "sponsorship",
  "visa",
  "salary",
  "notice.?period",
  "pronoun",
  "veteran",
  "disability",
  "ethnicity",
  "gender",
  "how.?did.?you.?hear",
];

export interface DetectionResult {
  isJobApplication: boolean;
  confidence: number; // 0-1
  signals: string[];
  hasFileUpload: boolean;
}

function hostMatches(hostname: string): boolean {
  return KNOWN_ATS_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`));
}

function scoreFieldKeywords(text: string): number {
  const re = new RegExp(FIELD_KEYWORDS.join("|"), "i");
  let hits = 0;
  for (const kw of FIELD_KEYWORDS) {
    if (new RegExp(kw, "i").test(text)) hits++;
  }
  return hits;
}

function collectFormSignal(): { fieldHits: number; textInputCount: number; hasFileUpload: boolean } {
  // queryAllDeep, not a plain querySelectorAll — a real ATS found during
  // testing (SmartRecruiters) renders its actual fields entirely inside
  // open shadow roots, invisible to a top-level query. See dom-deep.ts.
  const inputs = queryAllDeep(document, "input, textarea, select");
  const textInputCount = inputs.filter(
    (el) => el.tagName !== "INPUT" || !["hidden", "submit", "button", "checkbox", "radio"].includes((el as HTMLInputElement).type)
  ).length;
  const hasFileUpload = inputs.some((el) => el.tagName === "INPUT" && (el as HTMLInputElement).type === "file");

  const labelText = inputs
    .map((el) => {
      const id = el.getAttribute("id");
      const root = el.getRootNode() as Document | ShadowRoot;
      const associatedLabel = id ? root.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
      return [
        el.getAttribute("name"),
        el.getAttribute("id"),
        el.getAttribute("placeholder"),
        el.getAttribute("aria-label"),
        associatedLabel?.textContent,
      ]
        .filter(Boolean)
        .join(" ");
    })
    .join(" ");

  return { fieldHits: scoreFieldKeywords(labelText), textInputCount, hasFileUpload };
}

export function detectJobApplication(): DetectionResult {
  const hostname = location.hostname;
  const signals: string[] = [];

  if (OWN_APP_HOSTS.includes(location.host)) {
    return { isJobApplication: false, confidence: 0, signals: ["own-app-host"], hasFileUpload: false };
  }

  if (hostMatches(hostname)) {
    signals.push(`known-ats:${hostname}`);
    const { hasFileUpload } = collectFormSignal();
    return { isJobApplication: true, confidence: 0.95, signals, hasFileUpload };
  }

  let score = 0;

  const url = location.href.toLowerCase();
  if (URL_KEYWORDS.some((kw) => url.includes(kw))) {
    score += 1;
    signals.push("url-keyword");
  }

  const title = document.title.toLowerCase();
  if (URL_KEYWORDS.some((kw) => title.includes(kw))) {
    score += 1;
    signals.push("title-keyword");
  }

  const bodyText = document.body?.innerText?.toLowerCase().slice(0, 20000) ?? "";
  const textHits = PAGE_TEXT_KEYWORDS.filter((kw) => bodyText.includes(kw)).length;
  if (textHits > 0) {
    score += Math.min(textHits, 3); // cap contribution
    signals.push(`page-text-keywords:${textHits}`);
  }

  const { fieldHits, textInputCount, hasFileUpload } = collectFormSignal();
  if (fieldHits > 0) {
    score += fieldHits * 1.5;
    signals.push(`field-keywords:${fieldHits}`);
  }
  if (hasFileUpload) {
    score += 2;
    signals.push("file-upload-present");
  }
  if (textInputCount >= 4) {
    score += 1;
    signals.push(`text-input-count:${textInputCount}`);
  }

  // Normalize to a rough 0-1 confidence.
  const confidence = Math.min(score / 8, 1);

  // Page-text keywords alone can cross the threshold on a page that just
  // *talks about* job applications (a careers-product marketing page
  // mentioning "resume", "job description", "work authorization" reads
  // almost identically to a real one by text alone) — caught by dogfooding
  // this on Job Jet's own landing page, which has zero real form fields.
  // Require actual form-field evidence too: text signals alone are never
  // sufficient, only a multiplier on top of a page that has a plausible
  // application form on it.
  const hasFormEvidence = fieldHits > 0 || hasFileUpload || textInputCount >= 3;
  const isJobApplication = confidence >= 0.4 && hasFormEvidence;

  return { isJobApplication, confidence, signals, hasFileUpload };
}
