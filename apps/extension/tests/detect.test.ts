import { describe, expect, it } from "vitest";
import { detectJobApplication, hostMatches, scoreFieldKeywords } from "../src/lib/detect";
import { loadFixture } from "./helpers";

const DEV_BACKEND = "http://localhost:3001";

describe("hostMatches (known-ATS fast path)", () => {
  it("matches exact hosts and real subdomains", () => {
    expect(hostMatches("greenhouse.io")).toBe(true);
    expect(hostMatches("job-boards.greenhouse.io")).toBe(true);
    expect(hostMatches("acme.wd5.myworkdayjobs.com")).toBe(true);
    expect(hostMatches("jobs.lever.co")).toBe(true);
  });

  it("does not match look-alike domains", () => {
    expect(hostMatches("notgreenhouse.io")).toBe(false);
    expect(hostMatches("greenhouse.io.evil.com")).toBe(false);
    expect(hostMatches("example.com")).toBe(false);
  });
});

describe("scoreFieldKeywords", () => {
  it("counts each distinct keyword pattern once", () => {
    expect(scoreFieldKeywords("first_name last-name resume resume")).toBe(3);
  });

  it("matches separators and casing variants", () => {
    expect(scoreFieldKeywords("Cover Letter")).toBe(1);
    expect(scoreFieldKeywords("coverletter")).toBe(1);
    expect(scoreFieldKeywords("How did you hear about us?")).toBe(1);
  });

  it("returns 0 for unrelated text", () => {
    expect(scoreFieldKeywords("search query newsletter")).toBe(0);
  });
});

describe("detectJobApplication against fixture pages", () => {
  it("detects the single-page application form", () => {
    const doc = loadFixture("careers/senior-frontend-engineer/apply/index.html");
    const result = detectJobApplication(
      doc,
      "http://localhost:4000/careers/senior-frontend-engineer/apply/",
      DEV_BACKEND
    );
    expect(result.isJobApplication).toBe(true);
    expect(result.hasFileUpload).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.4);
    expect(result.signals).toContain("url-keyword");
    expect(result.signals.some((s) => s.startsWith("field-keywords:"))).toBe(true);
  });

  it("detects the multi-step wizard once a step's fields are rendered", () => {
    // The fixture renders each step's fields with JS (DOMParser doesn't run
    // scripts), so inject step 1's markup the way the page itself would.
    const doc = loadFixture("careers/product-manager/apply/index.html");
    const url = "http://localhost:4000/careers/product-manager/apply/";
    doc.getElementById("step-container")!.innerHTML =
      '<label for="firstName">First Name</label><input id="firstName" name="firstName" type="text" />' +
      '<label for="lastName">Last Name</label><input id="lastName" name="lastName" type="text" />' +
      '<label for="email">Email Address</label><input id="email" name="email" type="email" />' +
      '<label for="phone">Phone Number</label><input id="phone" name="phone" type="tel" />';
    const result = detectJobApplication(doc, url, DEV_BACKEND);
    expect(result.isJobApplication).toBe(true);
    expect(result.hasFileUpload).toBe(false);
  });

  it("does not flag the negative-control page (newsletter form only)", () => {
    const doc = loadFixture("about/index.html");
    const result = detectJobApplication(doc, "http://localhost:4000/about/", DEV_BACKEND);
    expect(result.isJobApplication).toBe(false);
  });

  it("requires form evidence — job-ish text alone is not enough", () => {
    const doc = new DOMParser().parseFromString(
      "<title>Careers</title><body><p>Apply now! Read the job description, attach your resume and cover letter. Work authorization and sponsorship info. Equal opportunity employer.</p></body>",
      "text/html"
    );
    const result = detectJobApplication(doc, "https://example.com/careers/apply", DEV_BACKEND);
    expect(result.confidence).toBeGreaterThanOrEqual(0.4);
    expect(result.isJobApplication).toBe(false);
  });
});

describe("detectJobApplication host rules", () => {
  it("short-circuits on known ATS hosts that have an application form", () => {
    const doc = new DOMParser().parseFromString(
      '<body><form><input name="name"><input name="email" type="email"><input name="phone"><input type="file" name="resume"></form></body>',
      "text/html"
    );
    const result = detectJobApplication(doc, "https://jobs.lever.co/acme/123/apply", DEV_BACKEND);
    expect(result).toMatchObject({ isJobApplication: true, confidence: 0.95 });
    expect(result.signals).toEqual(["known-ats:jobs.lever.co"]);
  });

  it("a known ATS host alone is not enough — no form, no button (bug 11)", () => {
    const doc = new DOMParser().parseFromString("<body></body>", "text/html");
    const result = detectJobApplication(doc, "https://jobs.lever.co/acme/123", DEV_BACKEND);
    expect(result.isJobApplication).toBe(false);
    expect(result.signals).toContain("no-application-form");
  });

  it("never flags Job Jet's own app (host derived from the backend URL)", () => {
    const doc = loadFixture("careers/senior-frontend-engineer/apply/index.html");
    const result = detectJobApplication(doc, "https://jobjet.example.com/dashboard", "https://jobjet.example.com");
    expect(result).toEqual({ isJobApplication: false, confidence: 0, signals: ["own-app-host"], hasFileUpload: false });
  });

  it("excludes the dev dashboard port but still detects fixtures on another localhost port", () => {
    const doc = loadFixture("careers/senior-frontend-engineer/apply/index.html");
    expect(detectJobApplication(doc, "http://localhost:3001/dashboard", DEV_BACKEND).isJobApplication).toBe(false);
    expect(detectJobApplication(doc, "http://127.0.0.1:3001/dashboard", DEV_BACKEND).isJobApplication).toBe(false);
    expect(
      detectJobApplication(doc, "http://localhost:4000/careers/senior-frontend-engineer/apply/", DEV_BACKEND)
        .isJobApplication
    ).toBe(true);
  });

  it("flags a company careers page that embeds a Greenhouse application iframe (bug 10)", () => {
    const doc = new DOMParser().parseFromString(
      `<html><body><h1>Account Manager</h1><iframe src="https://job-boards.greenhouse.io/embed/job_app?for=airbnb&token=1"></iframe></body></html>`,
      "text/html"
    );
    const result = detectJobApplication(doc, "https://careers.airbnb.com/positions/1", DEV_BACKEND);
    expect(result.isJobApplication).toBe(true);
    expect(result.signals).toContain("embedded-ats-iframe:1");
  });

  it("does not count an embedded LinkedIn frame or an iCIMS same-host job-description iframe (bug 11)", () => {
    const linkedin = new DOMParser().parseFromString(
      `<html><body><iframe src="https://www.linkedin.com/embed/feed"></iframe></body></html>`,
      "text/html"
    );
    expect(detectJobApplication(linkedin, "https://example.com/blog", DEV_BACKEND).isJobApplication).toBe(false);
    const icims = new DOMParser().parseFromString(
      `<html><body><input type="text" id="keyword-search"><input type="text" id="location-search"><input type="text" name="vendor-search-handler"><iframe src="https://careers-acme.icims.com/jobs/6592/job?in_iframe=1"></iframe></body></html>`,
      "text/html"
    );
    const result = detectJobApplication(icims, "https://careers-acme.icims.com/jobs/6592/job", DEV_BACKEND);
    expect(result.isJobApplication).toBe(false);
    expect(result.signals).toContain("no-application-form");
  });
});
