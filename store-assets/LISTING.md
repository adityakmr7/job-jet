# Chrome Web Store listing — 0.4.0 beta

Everything the Developer Dashboard asks for, ready to paste in. This is for
the **0.4.0 beta** upload (`version` `0.4.0`, shown to users as
`0.4.0 beta`), published **Unlisted**. Everywhere below, replace
`<PROD_DOMAIN>` with the production web app's domain: the same origin the
release zip was built with (`VITE_API_BASE_URL`). Check the items marked
**TODO** before you submit.

## Assets in this folder

| File                                         | Use                                                    | Size     |
| -------------------------------------------- | ------------------------------------------------------ | -------- |
| `screenshot-1-detect.png`                    | Screenshot: application form detected, side panel open | 1280×800 |
| `screenshot-2-autofill.png`                  | Screenshot: form autofilled, skill match               | 1280×800 |
| `screenshot-3-profile.png`                   | Screenshot: profile + resumes dashboard                | 1280×800 |
| `screenshot-4-tracker.png`                   | Screenshot: application tracker                        | 1280×800 |
| `screenshot-5-home.png`                      | Screenshot: website home (optional)                    | 1280×800 |
| `promo-small-440x280.png`                    | Small promo tile (required)                            | 440×280  |
| `promo-marquee-1400x560.png`                 | Marquee promo tile (optional)                          | 1400×560 |
| `../apps/extension/public/icons/icon128.png` | Store icon (96px artwork with 16px padding)            | 128×128  |

The screenshots show the real extension side panel and web dashboard, rendered
with sample data (a fictional candidate, "Priya Sharma") on a demo application
form. They were checked against the 0.4.0 beta UI on 2026-09-27: the side
panel, floating button, profile, tracker and home page still match the
redesign, so they can be used as they are. Screenshot 2 shows the "no resume
attached" case (the demo form's Resume/CV input is empty). 0.4.0 can also
attach your stored resume, in which case the panel adds "Attached your
resume." **TODO:** once the extension is live, you can swap in captures from
a real posting.

## Store listing

**Name** (max 75): `Job Jet — Autofill Job Applications & Tailor Your Resume`

**Short description / summary** (max 132; this one is 117):

> Autofill job applications on any careers site, tailor your resume to each role, and track every application you send.

**Category:** Productivity (alternative: Tools)

**Language:** English

**Detailed description:**

```
BETA: this is an early-access build of Job Jet (0.4.0 beta). Expect rough edges, and please report anything that fills wrong from the Job Jet website.

Job Jet takes the repetitive typing out of job applications, so you can spend your time on the parts that matter.

FILL APPLICATIONS IN SECONDS
• Upload your resume once. Job Jet turns it into a profile you can review and edit.
• On any application form, open the Job Jet side panel and click Autofill. Names, contact details, links, education, work authorization and more are filled from your profile.
• Works on hosted applicant-tracking pages (such as Greenhouse, Lever, Ashby and Workable), on companies' own careers sites, and on careers pages that embed one of those forms.
• Multi-step forms keep filling as you move to the next step.
• Attaches your resume to the form's resume field, unless you've already picked a file.
• Save answers to the questions every application asks: notice period, start date, salary expectation, how you heard about the company, relocation, work mode, and work authorization for each country. Add your own questions too.
• Job Jet never submits anything. Voluntary demographic questions (such as gender, ethnicity, disability or veteran status) are left to you unless you choose to save an answer for them. Open-ended answers are always left to you, and questions it isn't sure about are left empty rather than guessed.

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

**Official URL / homepage:** `https://<PROD_DOMAIN>`

**Support URL:** `https://<PROD_DOMAIN>` or your support email

**Privacy policy URL:** `https://<PROD_DOMAIN>/privacy`

**TODO before submitting:** set `NEXT_PUBLIC_CONTACT_EMAIL` in Vercel and
redeploy. Otherwise `/privacy` and `/terms` show "[contact email — to be
added]", and reviewers reject privacy policies that have no working contact.
Open the page and check it before you paste the URL.

## Privacy practices tab

### Single purpose

> Job Jet helps users apply for jobs: it fills job application forms from the user's saved profile, generates a resume tailored to the job being viewed, and tracks those applications.

### Permission justifications

| Permission                   | Justification to paste                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Host permission `<all_urls>` | Job application forms are hosted on thousands of different company careers sites and applicant-tracking domains, so there's no fixed list of sites. The content script needs to run on the page the user is viewing to detect an application form and read its field labels and the job description. Companies often embed the form from an applicant-tracking site in an iframe, so the script also runs in frames, but it does nothing in a frame unless that frame is a known applicant-tracking site. Page content is only sent to our server when the user clicks Autofill or Tailor resume. |
| `scripting`                  | Fills the application form on the active tab with the user's profile values, and only after the user clicks Autofill. We inject a function that is packaged with the extension into the page's main world (and into the frame that holds the form) so frameworks such as React register the typed values and the user's resume file can be attached. No remote code is executed.                                                                                                                                                                                                                  |
| `storage`                    | Keeps the user signed in: stores the extension's Job Jet session token (received when the user connects the extension on the Job Jet website) and a short-lived one-time value used during that connection. No browsing data is stored.                                                                                                                                                                                                                                                                                                                                                           |
| `sidePanel`                  | The extension's user interface is a side panel shown next to the job application.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `downloads`                  | Saves the tailored resume PDF the user generated to their Downloads folder, so they can attach it to the application form.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

**Remote code:** No. All code is packaged with the extension.

**`externally_connectable`** (manifest key, not a permission; no justification
field, but reviewers may ask): only the Job Jet website origin
(`https://<PROD_DOMAIN>/*`) may send the extension a message, and only to hand
over the user's session token after they click **Connect extension** on
`/extension-connect`. The extension verifies the sender page and a one-time
value before accepting it. No other website can message the extension.

The `cookies` permission from earlier builds is gone (0.3.0). Removing a
permission doesn't trigger extra review or a re-prompt for users.

### Data usage disclosures

"What user data do you plan to collect from users now or in the future?"
Tick these:

| Data type                           | Tick?   | What Job Jet collects                                                                                                                               |
| ----------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personally identifiable information | **Yes** | Name, email, phone, city/location, links, work and education history, and optional saved answers (notice period, salary expectation, work authorization per country, and voluntary self-identification answers only if the user sets them). |
| Health information                  | **Yes** | Only if the user chooses to save an answer to voluntary disability self-identification questions (off by default; never sent to AI).                |
| Financial and payment information   | No      | No payments in the beta.                                                                                                                            |
| Authentication information          | **Yes** | The Job Jet session token in extension storage, sent only to the Job Jet API. Account passwords are entered on the website, never in the extension. |
| Personal communications             | No      |                                                                                                                                                     |
| Location                            | No      | No GPS or IP-based location. The city the user types into their profile is covered under personally identifiable information.                       |
| Web history                         | **Yes** | The URL and title of job pages where the user clicks Autofill or Tailor resume, saved to their application tracker. Other browsing is not recorded. |
| User activity                       | No      | No click, keystroke or scroll tracking.                                                                                                             |
| Website content                     | **Yes** | Form field labels and job-description text from the page, sent only when the user clicks Autofill or Tailor resume.                                 |

Then certify all three:

- Data is not sold to third parties.
- Data is not used or transferred for purposes unrelated to the item's single purpose.
- Data is not used or transferred to determine creditworthiness or for lending.

**Remote code** ("Are you using remote code?"): **No, I am not using remote
code.** All JavaScript ships in the package. The extension CSP is
`script-src 'self'`, and the only scripts injected are functions bundled with
the extension.

## Test instructions (Dashboard → Test instructions)

> Job Jet needs a free account. Open https://<PROD_DOMAIN>/sign-up and create one with any email and password (or use Continue with Google). Upload any resume PDF on the Profile page. Then open the extension's side panel, click "Connect to Job Jet", and approve on the page that opens. Open a public job application, for example any job on job-boards.greenhouse.io or jobs.lever.co, and click Autofill. Nothing is ever submitted.

(**TODO:** if email verification is required and `RESEND_API_KEY` isn't set,
create a reviewer account yourself and paste its email and password here
instead.)

## Distribution

- **Visibility for the beta: _Unlisted_.** Only people with the link can
  install it, and it doesn't show up in search. Share the store link with
  testers. Switch to _Public_ for the stable 0.4.x/1.0 release. The listing
  and the extension ID stay the same when you do.
  - Alternative: _Private_ with trusted testers, which limits installs to
    specific Google accounts or a Google Group (Dashboard → Package →
    Distribution).
- **Regions:** all regions, unless you need to restrict them.
- **Pricing:** free.

## How these assets were made

- The screenshots were rendered in headless Chrome from the actual side-panel React app, using a local mock of the `chrome.*` APIs, and from the web dashboard pages, using sample data.
- The promo tiles are an HTML composition of the Job Jet logo and tagline.
- None of the preview scaffolding is committed.
