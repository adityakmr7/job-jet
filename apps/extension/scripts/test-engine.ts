import { firstAndLastName, findLink, yesNo } from "../src/lib/profile-utils";
import { getAdapter } from "../src/lib/adapters";
import { mapProfileToFields, runAutofillMapping, NEVER_FILL, matches } from "../src/lib/autofill-map";
import type { Profile, DetectedField } from "@job-jet/shared";

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

console.log("\n=== 1. Testing Profile Utils ===");
assert(firstAndLastName("Jane Doe").first === "Jane", "First name extraction");
assert(firstAndLastName("Jane Doe").last === "Doe", "Last name extraction");
assert(firstAndLastName("Dr. Jane Mary Doe").first === "Dr.", "Multi-word first name");
assert(firstAndLastName("Dr. Jane Mary Doe").last === "Jane Mary Doe", "Multi-word last name");
assert(firstAndLastName("SingleName").last === "", "Single name handles empty last name");
assert(yesNo(true) === "Yes", "yesNo(true)");
assert(yesNo(false) === "No", "yesNo(false)");
assert(yesNo(undefined) === undefined, "yesNo(undefined)");

const sampleProfile: Profile = {
  id: "p1",
  userId: "u1",
  fullName: "Alice Smith",
  email: "alice@example.com",
  phone: "+1 555 987 6543",
  location: "New York, NY",
  links: [
    { label: "LinkedIn", url: "https://linkedin.com/in/alicesmith" },
    { label: "GitHub", url: "https://github.com/alicesmith" },
    { label: "Portfolio", url: "https://alicesmith.dev" },
  ],
  summary: "Staff Engineer with 10 years of experience.",
  education: [
    { id: "e1", school: "MIT", degree: "B.S.", fieldOfStudy: "Computer Science" },
  ],
  experience: [
    {
      id: "x1",
      company: "Acme Corp",
      title: "Staff Engineer",
      current: true,
      bullets: ["Bullet 1", "Bullet 2"],
    },
  ],
  skills: [{ name: "TypeScript" }, { name: "React" }],
  workAuthorization: { authorizedToWork: true, requiresSponsorship: false },
};

assert(findLink(sampleProfile, "linkedin") === "https://linkedin.com/in/alicesmith", "Find LinkedIn");
assert(findLink(sampleProfile, "github") === "https://github.com/alicesmith", "Find GitHub");
assert(findLink(sampleProfile, "portfolio") === "https://alicesmith.dev", "Find Portfolio");

console.log("\n=== 2. Testing Adapter Hostname Matching ===");
assert(getAdapter("job-boards.greenhouse.io")?.name === "Greenhouse", "Greenhouse job-boards");
assert(getAdapter("boards.greenhouse.io")?.name === "Greenhouse", "Greenhouse boards");
assert(getAdapter("jobs.ashbyhq.com")?.name === "Ashby", "Ashby jobs");
assert(getAdapter("jobs.lever.co")?.name === "Lever", "Lever standard jobs");
assert(getAdapter("jobs.eu.lever.co")?.name === "Lever", "Lever EU subdomains (jobs.eu.lever.co)");

console.log("\n=== 3. Testing Autofill Heuristics & Exclusions ===");
const fields: DetectedField[] = [
  { selector: "s-first", type: "text", label: "First Name" },
  { selector: "s-last", type: "text", label: "Last Name" },
  { selector: "s-full", type: "text", label: "Full Name" },
  { selector: "s-legal", type: "text", label: "Legal Name" },
  { selector: "s-name", type: "text", label: "Name", name: "name" },
  { selector: "s-email", type: "email", label: "Email Address" },
  { selector: "s-phone", type: "tel", label: "Phone Number" },
  { selector: "s-loc", type: "text", label: "Location" },
  { selector: "s-linkedin", type: "url", label: "LinkedIn URL" },
  { selector: "s-github", type: "url", label: "GitHub Profile" },
  { selector: "s-portfolio", type: "url", label: "Personal Website" },
  { selector: "s-auth", type: "select", label: "Are you authorized to work in the US?" },
  { selector: "s-sponsor", type: "select", label: "Will you require visa sponsorship?" },
  { selector: "s-company", type: "text", label: "Current Company" },
  { selector: "s-title", type: "text", label: "Current Title" },
  { selector: "s-school", type: "text", label: "School / University" },
  { selector: "s-degree", type: "text", label: "Degree" },
  { selector: "s-major", type: "text", label: "Major / Field of Study" },
  // Exclusions (EEO & File)
  { selector: "s-file", type: "file", label: "Upload Resume" },
  { selector: "s-gender", type: "select", label: "Gender" },
  { selector: "s-race", type: "select", label: "Race / Ethnicity" },
  { selector: "s-veteran", type: "select", label: "Veteran Status" },
  { selector: "s-disability", type: "select", label: "Disability Status" },
  { selector: "s-pronouns", type: "select", label: "Pronouns" },
];

const mapped = mapProfileToFields(fields, sampleProfile);
const map = new Map(mapped.map((m) => [m.selector, m.value]));

assert(map.get("s-first") === "Alice", "Mapped first name");
assert(map.get("s-last") === "Smith", "Mapped last name");
assert(map.get("s-full") === "Alice Smith", "Mapped full name");
assert(map.get("s-legal") === "Alice Smith", "Mapped legal name");
assert(map.get("s-name") === "Alice Smith", "Mapped generic Name field");
assert(map.get("s-email") === "alice@example.com", "Mapped email");
assert(map.get("s-phone") === "+1 555 987 6543", "Mapped phone");
assert(map.get("s-loc") === "New York, NY", "Mapped location");
assert(map.get("s-linkedin") === "https://linkedin.com/in/alicesmith", "Mapped LinkedIn");
assert(map.get("s-github") === "https://github.com/alicesmith", "Mapped GitHub specifically");
assert(map.get("s-portfolio") === "https://alicesmith.dev", "Mapped Portfolio");
assert(map.get("s-auth") === "Yes", "Mapped Work Auth");
assert(map.get("s-sponsor") === "No", "Mapped Sponsorship");
assert(map.get("s-company") === "Acme Corp", "Mapped current company");
assert(map.get("s-title") === "Staff Engineer", "Mapped current title");
assert(map.get("s-school") === "MIT", "Mapped school");
assert(map.get("s-degree") === "B.S.", "Mapped degree");
assert(map.get("s-major") === "Computer Science", "Mapped major / field of study");

// Ensure exclusions are never mapped
assert(!map.has("s-file"), "Resume file input skipped");
assert(!map.has("s-gender"), "Gender excluded by NEVER_FILL");
assert(!map.has("s-race"), "Race excluded by NEVER_FILL");
assert(!map.has("s-veteran"), "Veteran status excluded by NEVER_FILL");
assert(!map.has("s-disability"), "Disability excluded by NEVER_FILL");
assert(!map.has("s-pronouns"), "Pronouns excluded by NEVER_FILL");

console.log("\n=== 4. Testing Negative Name Matching ===");
const negativeNameFields: DetectedField[] = [
  { selector: "neg-company", type: "text", label: "Company Name" },
  { selector: "neg-school", type: "text", label: "School Name" },
  { selector: "neg-user", type: "text", label: "Username" },
  { selector: "neg-preferred", type: "text", label: "Preferred Name" },
];
const negMapped = mapProfileToFields(negativeNameFields, sampleProfile);
const negMap = new Map(negMapped.map((m) => [m.selector, m.value]));
assert(negMap.get("neg-company") === "Acme Corp", "Company Name maps to company, not person name");
assert(negMap.get("neg-school") === "MIT", "School Name maps to school, not person name");
assert(!negMap.has("neg-user"), "Username is not mapped to full name");
assert(!negMap.has("neg-preferred"), "Preferred Name is not mapped to full name");

console.log("\n=== 5. Testing Link Fallbacks ===");
const profileNoPortfolio: Profile = {
  ...sampleProfile,
  links: [
    { label: "LinkedIn", url: "https://linkedin.com/in/alicesmith" },
    { label: "GitHub", url: "https://github.com/alicesmith" },
  ],
};
const websiteFields: DetectedField[] = [
  { selector: "w-site", type: "text", label: "Personal Website" },
  { selector: "w-gh", type: "text", label: "GitHub Profile" },
];
const siteMapped = mapProfileToFields(websiteFields, profileNoPortfolio);
const siteMap = new Map(siteMapped.map((m) => [m.selector, m.value]));
assert(siteMap.get("w-gh") === "https://github.com/alicesmith", "GitHub mapped specifically");
assert(siteMap.get("w-site") === "https://github.com/alicesmith", "Website falls back to GitHub when no portfolio");

console.log("\n=== 6. Testing Adapter Precedence & Composition ===");
const leverFieldsTest: DetectedField[] = [
  { selector: "lev-1", type: "text", name: "name", label: "Full Name" },
  { selector: "lev-2", type: "text", name: "email", label: "Email" },
  { selector: "lev-3", type: "text", id: "custom_q1", label: "Current Title" },
];
const composed = runAutofillMapping(leverFieldsTest, sampleProfile, "jobs.lever.co");
const compMap = new Map(composed.map((m) => [m.selector, m.value]));
assert(compMap.get("lev-1") === "Alice Smith", "Adapter claims core field name");
assert(compMap.get("lev-2") === "alice@example.com", "Adapter claims core field email");
assert(compMap.get("lev-3") === "Staff Engineer", "Heuristic fills remaining custom field");

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

