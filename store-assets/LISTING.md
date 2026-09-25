# Chrome Web Store listing — draft

Everything the Developer Dashboard asks for, ready to paste in. Check the
items marked **TODO** before you submit.

## Assets in this folder

| File | Use | Size |
| --- | --- | --- |
| `screenshot-1-detect.png` | Screenshot: application form detected, side panel open | 1280×800 |
| `screenshot-2-autofill.png` | Screenshot: form autofilled, skill match | 1280×800 |
| `screenshot-3-profile.png` | Screenshot: profile + resumes dashboard | 1280×800 |
| `screenshot-4-tracker.png` | Screenshot: application tracker | 1280×800 |
| `screenshot-5-home.png` | Screenshot: website home (optional) | 1280×800 |
| `promo-small-440x280.png` | Small promo tile (required) | 440×280 |
| `promo-marquee-1400x560.png` | Marquee promo tile (optional) | 1400×560 |
| `../apps/extension/public/icons/icon128.png` | Store icon (96px artwork with 16px padding) | 128×128 |

The screenshots show the real extension side panel and web dashboard, rendered
with sample data (a fictional candidate, "Priya Sharma") on a demo application
form. **TODO:** once the extension is live, you can swap in captures from a
real posting.

## Store listing

**Name** (max 75): `Job Jet — Autofill Job Applications & Tailor Your Resume`

**Short description / summary** (max 132; this one is 117):

> Autofill job applications on any careers site, tailor your resume to each role, and track every application you send.

**Category:** Productivity (alternative: Tools)

**Language:** English

**Detailed description:**

```
Job Jet takes the repetitive typing out of job applications, so you can spend your time on the parts that matter.

FILL APPLICATIONS IN SECONDS
• Upload your resume once. Job Jet turns it into a profile you can review and edit.
• On any application form, open the Job Jet side panel and click Autofill. Names, contact details, links, education, work authorization and more are filled from your profile.
• Works on hosted applicant-tracking pages (such as Greenhouse, Lever and Ashby) and on companies' own careers sites.
• Multi-step forms keep filling as you move to the next step.
• Job Jet never submits anything. File uploads, voluntary demographic questions and open-ended answers are always left to you.

A RESUME FOR EVERY ROLE
• Generate a version of your resume tailored to the job post you're on, as a clean PDF saved to your Downloads folder, ready to attach.
• Tailoring only rewords what's already true. Employers, titles, dates, education and contact details are copied from your profile unchanged, and no new skills are added.

SEE HOW WELL YOU FIT
• Skill match shows which skills from your profile the job post mentions. It's worked out locally, right in the panel.

TRACK EVERY APPLICATION
• Every job you autofill or tailor a resume for is added to your tracker on the Job Jet website, with status, notes and the resume version you sent.

PRIVATE BY DESIGN
• Your resumes are kept in private storage and only you can download them.
• Page content only leaves your browser when you use a feature: form field labels for Autofill, or the job description for tailoring.
• We don't sell your data or use it for advertising.

Job Jet is free while it's in beta. You'll need a free Job Jet account.
```

**Official URL / homepage:** `https://<your-domain>` (**TODO**)

**Support URL:** `https://<your-domain>` or a support email (**TODO**)

**Privacy policy URL:** `https://<your-domain>/privacy` (**TODO**: set `NEXT_PUBLIC_CONTACT_EMAIL` on the web app first)

## Privacy practices tab

### Single purpose

> Job Jet helps users apply for jobs: it fills job application forms from the user's saved profile, generates a resume tailored to the job being viewed, and tracks those applications.

### Permission justifications

| Permission | Justification to paste |
| --- | --- |
| Host permission `<all_urls>` | Job application forms are hosted on thousands of different company careers sites and applicant-tracking domains, so there's no fixed list of sites. The content script needs to run on the page the user is viewing to detect an application form and read its field labels and the job description. Page content is only sent to our server when the user clicks Autofill or Tailor resume. |
| `scripting` | Fills the application form on the active tab with the user's profile values, and only after the user clicks Autofill. We inject a function into the page's main world so frameworks such as React register the typed values. No remote code is executed. |
| `storage` | Keeps the user signed in. Our authentication provider (Clerk) stores the session in extension storage. |
| `cookies` | Syncs the sign-in session between the Job Jet website and the extension (Clerk's session sync for browser extensions), so users sign in once. |
| `sidePanel` | The extension's user interface is a side panel shown next to the job application. |
| `downloads` | Saves the tailored resume PDF the user generated to their Downloads folder, so they can attach it to the application form. |

**Remote code:** No. All code is packaged with the extension.

### Data usage disclosures

Tick these data types:

- **Personally identifiable information:** name, email, phone and address/location from the user's profile.
- **Authentication information:** session tokens handled by Clerk.
- **Website content:** form field labels and job-description text from the page, sent only when the user uses a feature.
- **User activity:** URLs of job pages the user autofills or tailors a resume for, used for the application tracker.

Then certify all three:

- Data is not sold to third parties.
- Data is not used or transferred for purposes unrelated to the item's single purpose.
- Data is not used or transferred to determine creditworthiness or for lending.

## Distribution

- **Visibility:** start as *Unlisted* for a soft launch, then switch to *Public*.
- **Regions:** all regions, unless you need to restrict them.

## How these assets were made

- The screenshots were rendered in headless Chrome from the actual side-panel React app, using a local mock of the `chrome.*` APIs, and from the web dashboard pages, using sample data.
- The promo tiles are an HTML composition of the Job Jet logo and tagline.
- None of the preview scaffolding is committed.
