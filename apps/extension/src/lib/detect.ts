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
import { isOwnAppHost } from "./own-app";

// Known ATS hostnames — fast path that skips scoring, though the page must
// still actually contain an application form (see hasApplicationForm).
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

// Job Jet's own web app is never a job application — see own-app.ts. The
// excluded hosts are derived from the configured backend URL at build time,
// so production builds exclude the production domain automatically.
const BACKEND_URL: string | undefined = import.meta.env.VITE_API_BASE_URL;

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

export function hostMatches(hostname: string): boolean {
  return KNOWN_ATS_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`));
}

export function scoreFieldKeywords(text: string): number {
  let hits = 0;
  for (const kw of FIELD_KEYWORDS) {
    if (new RegExp(kw, "i").test(text)) hits++;
  }
  return hits;
}

function collectFormSignal(doc: Document): {
  fieldHits: number;
  textInputCount: number;
  hasFileUpload: boolean;
  hasPassword: boolean;
} {
  // queryAllDeep, not a plain querySelectorAll — a real ATS found during
  // testing (SmartRecruiters) renders its actual fields entirely inside
  // open shadow roots, invisible to a top-level query. See dom-deep.ts.
  const inputs = queryAllDeep(doc, "input, textarea, select");
  // Search boxes (job-search bars, cookie-banner vendor search) aren't form
  // fields even when typed as text — found live: an iCIMS job page reached
  // the ≥3 threshold on keyword/location/cookie-list search inputs alone.
  const isSearchBox = (el: Element) =>
    /search|query|keyword/i.test(
      [el.getAttribute("id"), el.getAttribute("name"), el.getAttribute("aria-label"), el.getAttribute("placeholder")].join(" ")
    ) || !!el.closest("[role=search]");
  const textInputCount = inputs.filter(
    (el) =>
      (el.tagName !== "INPUT" ||
        !["hidden", "submit", "button", "checkbox", "radio", "password", "search", "file"].includes(
          (el as HTMLInputElement).type
        )) &&
      !isSearchBox(el)
  ).length;
  const hasFileUpload = inputs.some((el) => el.tagName === "INPUT" && (el as HTMLInputElement).type === "file");
  const hasPassword = inputs.some((el) => el.tagName === "INPUT" && (el as HTMLInputElement).type === "password");

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

  return { fieldHits: scoreFieldKeywords(labelText), textInputCount, hasFileUpload, hasPassword };
}

/** Iframes whose src is a known ATS application form — a company careers
 *  page embedding Greenhouse (found live on careers.airbnb.com). */
export function embeddedAtsFrames(doc: Document): string[] {
  return Array.from(doc.querySelectorAll("iframe[src]"))
    .map((f) => f.getAttribute("src") ?? "")
    .filter((src) => {
      try {
        const host = new URL(src, doc.baseURI || "https://invalid.example").hostname;
        return host !== "linkedin.com" && !host.endsWith(".linkedin.com") && hostMatches(host);
      } catch {
        return false;
      }
    });
}

/** Actual application-form evidence on the page. Found live: the floating
 *  button showed on a SmartRecruiters "Verification Required" captcha page
 *  and on Workday/iCIMS job-description pages with no form at all, because a
 *  known ATS hostname alone used to be enough. A sign-in wall (password
 *  field, no application fields) isn't an application form either. */
function hasApplicationForm(signal: ReturnType<typeof collectFormSignal>, embedded: number): boolean {
  if (embedded > 0) return true;
  const { fieldHits, textInputCount, hasFileUpload, hasPassword } = signal;
  if (hasPassword && fieldHits === 0 && !hasFileUpload) return false;
  return hasFileUpload || fieldHits > 0 || textInputCount >= 3;
}

/**
 * @param doc  Document to inspect (defaults to the live page).
 * @param href URL of that document (defaults to the live page's URL).
 * @param backendUrl Job Jet's own web app URL, whose host is never treated
 *   as a job application (defaults to the build-time VITE_API_BASE_URL).
 */
export function detectJobApplication(
  doc: Document = document,
  href: string = location.href,
  backendUrl: string | undefined = BACKEND_URL
): DetectionResult {
  const pageUrl = new URL(href);
  const hostname = pageUrl.hostname;
  const signals: string[] = [];

  if (isOwnAppHost(pageUrl.host, backendUrl)) {
    return { isJobApplication: false, confidence: 0, signals: ["own-app-host"], hasFileUpload: false };
  }

  // On an ATS host itself, a same-host iframe is usually just the job
  // description (iCIMS renders its job pages in one); only count it when the
  // frame URL looks like an application step.
  const embedded = embeddedAtsFrames(doc).filter((src) => {
    if (!hostMatches(hostname)) return true;
    try {
      const u = new URL(src, doc.baseURI || "https://invalid.example");
      return u.hostname !== hostname || /apply|application|candidate|job_app/i.test(u.pathname);
    } catch {
      return false;
    }
  }).length;

  if (hostMatches(hostname)) {
    signals.push(`known-ats:${hostname}`);
    const signal = collectFormSignal(doc);
    if (!hasApplicationForm(signal, embedded)) {
      signals.push("no-application-form");
      return { isJobApplication: false, confidence: 0.3, signals, hasFileUpload: signal.hasFileUpload };
    }
    return { isJobApplication: true, confidence: 0.95, signals, hasFileUpload: signal.hasFileUpload };
  }

  if (embedded > 0) {
    signals.push(`embedded-ats-iframe:${embedded}`);
    return { isJobApplication: true, confidence: 0.9, signals, hasFileUpload: false };
  }

  let score = 0;

  const url = href.toLowerCase();
  if (URL_KEYWORDS.some((kw) => url.includes(kw))) {
    score += 1;
    signals.push("url-keyword");
  }

  const title = doc.title.toLowerCase();
  if (URL_KEYWORDS.some((kw) => title.includes(kw))) {
    score += 1;
    signals.push("title-keyword");
  }

  const bodyText = doc.body?.innerText?.toLowerCase().slice(0, 20000) ?? "";
  const textHits = PAGE_TEXT_KEYWORDS.filter((kw) => bodyText.includes(kw)).length;
  if (textHits > 0) {
    score += Math.min(textHits, 3); // cap contribution
    signals.push(`page-text-keywords:${textHits}`);
  }

  const formSignal = collectFormSignal(doc);
  const { fieldHits, textInputCount, hasFileUpload } = formSignal;
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
  const hasFormEvidence = hasApplicationForm(formSignal, 0);
  const isJobApplication = confidence >= 0.4 && hasFormEvidence;

  return { isJobApplication, confidence, signals, hasFileUpload };
}
