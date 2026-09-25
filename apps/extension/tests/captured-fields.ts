import type { DetectedField } from "@job-jet/shared";

// DetectedField data captured from real, live postings (same data as
// scripts/verify-adapters.ts).

// job-boards.greenhouse.io/figma/jobs/6142506004
export const greenhouseFields: DetectedField[] = [
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

// jobs.lever.co/palantir/.../apply
export const leverFields: DetectedField[] = [
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

// jobs.ashbyhq.com/fieldguide/.../application
export const ashbyFields: DetectedField[] = [
  { selector: "sel-0", type: "file", id: "", label: undefined },
  { selector: "sel-1", type: "text", id: "_systemfield_name", label: "Legal Name" },
  { selector: "sel-2", type: "text", id: "d4ac44ed-9953-4bd1-a363-a7ac6f3f652d", label: "Preferred Name" },
  { selector: "sel-3", type: "text", id: "1fe540c7-92e1-4528-b49a-b9d20d156b30", label: "Preferred Pronouns" },
  { selector: "sel-4", type: "email", id: "_systemfield_email", label: "Email" },
  { selector: "sel-5", type: "tel", id: "90fa4e83-943d-46bc-8e1f-e05186d34210", label: "Phone Number" },
  { selector: "sel-6", type: "file", id: "_systemfield_resume", label: "Resume" },
  { selector: "sel-7", type: "text", id: "6aaa8c0e-4f0f-46dd-b9aa-000000000001", label: "LinkedIn Profile" },
  { selector: "sel-8", type: "text", id: "c3256962-823c-4185-9def-000000000002", label: "Portfolio/Personal Website" },
];
