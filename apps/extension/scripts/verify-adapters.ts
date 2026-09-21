/**
 * Ad-hoc verification: runs the real adapter + heuristic composition
 * against DetectedField data captured from real, live job postings (not
 * synthetic test fixtures) — a Greenhouse posting at
 * job-boards.greenhouse.io/figma/jobs/6142506004, a Lever posting at
 * jobs.lever.co/palantir/.../apply, and an Ashby posting at
 * jobs.ashbyhq.com/fieldguide/.../application — to confirm the adapters
 * actually target the right elements and the heuristic correctly picks up
 * whatever the adapter leaves for it (custom per-job questions), before
 * relying on a full browser reload to see it work.
 *
 * Not a permanent test suite (no test runner wired up yet) — run directly
 * with `npx tsx scripts/verify-adapters.ts`.
 */
import type { DetectedField, Profile } from "@job-jet/shared";
import { runAutofillMapping } from "../src/lib/autofill-map";

const profile: Profile = {
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
  education: [{ id: "e1", school: "University of Washington", degree: "B.S." }],
  experience: [
    {
      id: "x1",
      company: "Nimbus Analytics",
      title: "Senior Frontend Engineer",
      current: true,
      bullets: [],
    },
  ],
  skills: [],
  workAuthorization: { authorizedToWork: true, requiresSponsorship: false },
};

// Field data as actually captured from job-boards.greenhouse.io/figma/jobs/6142506004
const greenhouseFields: DetectedField[] = [
  { selector: "sel-0", type: "text", id: "first_name", label: "First Name*" },
  { selector: "sel-1", type: "text", id: "last_name", label: "Last Name*" },
  { selector: "sel-2", type: "text", id: "email", label: "Email*" },
  { selector: "sel-3", type: "tel", id: "phone", label: "Phone*" },
  { selector: "sel-4", type: "text", id: "candidate-location", label: "Location (City)*" },
  { selector: "sel-5", type: "file", id: "resume", label: "Attach" },
  { selector: "sel-6", type: "text", id: "question_19432571004", label: "LinkedIn Profile" },
  { selector: "sel-7", type: "text", id: "question_19432572004", label: "Other Website" },
  { selector: "sel-8", type: "text", id: "question_19432574004", label: "Pronouns" },
  { selector: "sel-9", type: "text", id: "gender", label: "Gender" },
  { selector: "sel-10", type: "text", id: "veteran_status", label: "Veteran Status" },
];

// Field data as actually captured from jobs.lever.co/palantir/.../apply
const leverFields: DetectedField[] = [
  { selector: "sel-0", type: "file", name: "resume", label: "Resume/CV *" },
  { selector: "sel-1", type: "text", name: "name", label: "Full name*" },
  { selector: "sel-2", type: "email", name: "email", label: "Email*" },
  { selector: "sel-3", type: "text", name: "phone", label: "Phone" },
  { selector: "sel-4", type: "text", name: "location", label: "Current location *" },
  { selector: "sel-5", type: "text", name: "org", label: "Current company" },
  { selector: "sel-6", type: "text", name: "urls[LinkedIn]", label: "LinkedIn URL" },
  { selector: "sel-7", type: "text", name: "urls[GitHub]", label: "GitHub URL" },
  { selector: "sel-8", type: "text", name: "urls[Portfolio]", label: "Portfolio URL" },
  {
    selector: "sel-9",
    type: "text",
    name: "cards[x][field2]",
    label: "What is your anticipated start date? (Month/Year)",
  },
];

// Field data as actually captured from jobs.ashbyhq.com/fieldguide/.../application
const ashbyFields: DetectedField[] = [
  { selector: "sel-0", type: "file", id: "", label: undefined },
  { selector: "sel-1", type: "text", id: "_systemfield_name", label: "Legal Name" },
  { selector: "sel-2", type: "text", id: "d4ac44ed-9953-4bd1-a363-a7ac6f3f652d", label: "Preferred Name" },
  { selector: "sel-3", type: "text", id: "1fe540c7-92e1-4528-b49a-b9d20d156b30", label: "Preferred Pronouns" },
  { selector: "sel-4", type: "email", id: "_systemfield_email", label: "Email" },
  { selector: "sel-5", type: "tel", id: "90fa4e83-943d-46bc-8e1f-e05186d34210", label: "Phone Number" },
  { selector: "sel-6", type: "file", id: "_systemfield_resume", label: "Resume" },
  { selector: "sel-7", type: "text", id: "6aaa8c0e-4f0f-46dd-b9aa-000000000001", label: "LinkedIn Profile" },
  {
    selector: "sel-8",
    type: "text",
    id: "c3256962-823c-4185-9def-000000000002",
    label: "Portfolio/Personal Website",
  },
];

function report(name: string, fields: DetectedField[], hostname: string) {
  const results = runAutofillMapping(fields, profile, hostname);
  const byField = new Map(results.map((r) => [r.selector, r.value]));
  console.log(`\n=== ${name} (${results.length}/${fields.length} filled) ===`);
  for (const f of fields) {
    const value = byField.get(f.selector);
    console.log(`  ${(f.label ?? f.id ?? f.name ?? "?").padEnd(45)} -> ${value ?? "(not filled)"}`);
  }
}

report("Greenhouse (Figma posting)", greenhouseFields, "job-boards.greenhouse.io");
report("Lever (Palantir posting)", leverFields, "jobs.lever.co");
report("Ashby (Fieldguide posting)", ashbyFields, "jobs.ashbyhq.com");
