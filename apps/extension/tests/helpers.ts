import { readFileSync } from "node:fs";
import { fileURLToPath, URL as NodeURL } from "node:url";
import type { Profile } from "@job-jet/shared";

// node:url's URL, not jsdom's global one (which rejects file: in fileURLToPath).
const FIXTURES = fileURLToPath(new NodeURL("../test-fixtures/", import.meta.url));

/** Parses one of the checked-in fixture pages into a standalone Document. */
export function loadFixture(relativePath: string): Document {
  const html = readFileSync(FIXTURES + relativePath, "utf8");
  return new DOMParser().parseFromString(html, "text/html");
}

/** Replaces the live jsdom document's contents with a fixture page. */
export function mountFixture(relativePath: string): void {
  const doc = loadFixture(relativePath);
  document.head.innerHTML = doc.head.innerHTML;
  document.body.innerHTML = doc.body.innerHTML;
  document.title = doc.title;
}

export const profile: Profile = {
  id: "p1",
  userId: "u1",
  fullName: "Priya Sharma",
  email: "priya.sharma@example.com",
  phone: "+1 415 555 0192",
  location: "San Francisco, CA",
  links: [
    { label: "LinkedIn", url: "https://linkedin.com/in/priyasharma" },
    { label: "GitHub", url: "https://github.com/priyasharma" },
    { label: "Portfolio", url: "https://priyasharma.dev" },
  ],
  summary: "Frontend engineer with 6 years of experience.",
  education: [{ id: "e1", school: "University of Washington", degree: "B.S.", fieldOfStudy: "Computer Science" }],
  experience: [
    { id: "x1", company: "Nimbus Analytics", title: "Senior Frontend Engineer", current: true, bullets: [] },
    { id: "x2", company: "Brightline", title: "Frontend Engineer", current: false, bullets: [] },
  ],
  skills: [],
  workAuthorization: { authorizedToWork: true, requiresSponsorship: false },
};
