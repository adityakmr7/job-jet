/** Bug 10 (embedded ATS iframes) and bug 11 (button only with a real form). */
import { describe, expect, it } from "vitest";
import { groupByFrame, isAtsFrameUrl, selectTargetFrames, shouldActivateInFrame } from "../src/lib/frames";
import { detectJobApplication, embeddedAtsFrames } from "../src/lib/detect";

const DEV_BACKEND = "http://localhost:3001";
const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

describe("bug 10: embedded ATS frames", () => {
  it("queries the top frame plus known-ATS iframes only", () => {
    expect(
      selectTargetFrames([
        { frameId: 0, url: "https://careers.airbnb.com/positions/8184174" },
        { frameId: 4, url: "https://job-boards.greenhouse.io/embed/job_app?for=airbnb&token=8184174" },
        { frameId: 5, url: "https://www.google.com/recaptcha/api2/anchor?k=x" },
        { frameId: 6, url: "https://www.linkedin.com/embed/feed" },
        { frameId: 7, url: "about:blank" },
      ])
    ).toEqual([0, 4]);
    expect(selectTargetFrames([])).toEqual([0]);
  });

  it("the content script is inert in non-ATS subframes", () => {
    expect(shouldActivateInFrame(true, "careers.airbnb.com")).toBe(true);
    expect(shouldActivateInFrame(false, "job-boards.greenhouse.io")).toBe(true);
    expect(shouldActivateInFrame(false, "jobs.lever.co")).toBe(true);
    expect(shouldActivateInFrame(false, "www.google.com")).toBe(false);
    expect(shouldActivateInFrame(false, "www.linkedin.com")).toBe(false);
    expect(shouldActivateInFrame(false, "greenhouse.io.evil.com")).toBe(false);
    expect(isAtsFrameUrl("javascript:alert(1)")).toBe(false);
  });

  it("groups mapped values by the frame their field lives in", () => {
    const frameOf = new Map([
      ["a", 0],
      ["b", 4],
    ]);
    const groups = groupByFrame(
      [
        { selector: "a", value: "1" },
        { selector: "b", value: "2" },
        { selector: "c", value: "3" },
      ],
      frameOf
    );
    expect(Object.fromEntries(groups)).toEqual({
      0: [
        { selector: "a", value: "1" },
        { selector: "c", value: "3" },
      ],
      4: [{ selector: "b", value: "2" }],
    });
  });

  it("a careers page embedding Greenhouse gets the button", () => {
    const doc = parse(
      `<title>Senior Engineer - Airbnb Careers</title><body><h1>Senior Engineer</h1>
       <div id="grnhse_app"><iframe id="grnhse_iframe" src="https://job-boards.greenhouse.io/embed/job_app?for=airbnb&token=8184174"></iframe></div></body>`
    );
    expect(embeddedAtsFrames(doc)).toHaveLength(1);
    const result = detectJobApplication(doc, "https://careers.airbnb.com/positions/8184174", DEV_BACKEND);
    expect(result.isJobApplication).toBe(true);
    expect(result.signals).toContain("embedded-ats-iframe:1");
  });

  it("a LinkedIn embed is not an embedded application form", () => {
    const doc = parse(`<body><iframe src="https://www.linkedin.com/embed/feed/update/1"></iframe></body>`);
    expect(embeddedAtsFrames(doc)).toEqual([]);
  });
});

describe("bug 11: floating button only on pages with an application form", () => {
  it("SmartRecruiters bot-check page (no form) → no button", () => {
    const doc = parse(`<body><h1>Verification Required</h1><p>Slide right to complete the puzzle.</p><div class="slider"></div></body>`);
    const r = detectJobApplication(doc, "https://jobs.smartrecruiters.com/oneclick-ui/company/X/publication/1", DEV_BACKEND);
    expect(r.isJobApplication).toBe(false);
  });

  it("Workday job description with only a search box → no button", () => {
    const doc = parse(
      `<body><input type="search" aria-label="Search for jobs"><h2>Senior Software Engineer</h2><p>Job description … Apply</p></body>`
    );
    expect(detectJobApplication(doc, "https://nvidia.wd5.myworkdayjobs.com/en-US/x/job/y", DEV_BACKEND).isJobApplication).toBe(false);
  });

  it("Workday / iCIMS sign-in wall (email + password) → no button", () => {
    const doc = parse(
      `<body><form><label for="e">Email Address</label><input id="e" type="email"><label for="p">Password</label><input id="p" type="password"><input type="password" id="p2"><button>Create Account</button></form></body>`
    );
    expect(detectJobApplication(doc, "https://nvidia.wd5.myworkdayjobs.com/x/apply/applyManually", DEV_BACKEND).isJobApplication).toBe(false);
  });

  it("a real application form on a known ATS host → button", () => {
    const doc = parse(
      `<body><form><label for="f">First Name</label><input id="f"><label for="l">Last Name</label><input id="l"><input type="email" id="e"><input type="file" id="resume"></form></body>`
    );
    expect(detectJobApplication(doc, "https://job-boards.greenhouse.io/acme/jobs/1", DEV_BACKEND).isJobApplication).toBe(true);
  });
});
