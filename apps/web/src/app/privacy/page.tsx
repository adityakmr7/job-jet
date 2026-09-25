import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${SITE_NAME} collects, uses, and protects your data.`,
};

// NOTE(owner): review this text (and have it reviewed if needed) before
// publishing, and set NEXT_PUBLIC_CONTACT_EMAIL. It describes the app as
// built in this repository; update it whenever data handling changes.
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        {SITE_NAME} (&quot;we&quot;, &quot;us&quot;) is a web app and Chrome extension that helps you fill in job
        applications and generate resumes tailored to a job description. This policy explains what data we collect, why,
        where it is stored, and the choices you have.
      </p>

      <h2>Data we collect</h2>
      <h3>Account information</h3>
      <p>
        Sign-in is handled by <a href="https://clerk.com/legal/privacy">Clerk</a>. We receive and store your Clerk user
        ID and email address so your data can be linked to your account.
      </p>
      <h3>Profile</h3>
      <p>
        Information you enter or that is parsed from your resume: name, email, phone number, location, links (e.g.
        LinkedIn, GitHub, portfolio), summary, education, work experience, skills, and your answers to common
        application questions such as work authorization and visa sponsorship.
      </p>
      <h3>Resumes</h3>
      <p>
        Resume files you upload (PDF or DOCX), the structured content extracted from them, and resumes we generate for
        you, including the job description (and optional job title/company) each tailored resume was generated for.
      </p>
      <h3>Job applications you track</h3>
      <p>
        When you use autofill or generate a tailored resume on a job page, the extension saves that page&apos;s URL,
        website domain, a best-guess job title, and the extracted job description to your application tracker. You can
        add a company, notes, a status, and a linked resume, and delete entries at any time from your dashboard.
      </p>
      <h3>Form field descriptions (autofill)</h3>
      <p>
        When autofill can&apos;t recognize a form field on its own, the extension sends that field&apos;s description
        (its label, name, placeholder, input type, and any dropdown options) and the website&apos;s hostname to our
        server. We do not send what you have typed into the page. To avoid repeated AI calls, we keep a shared cache
        that maps a website hostname plus a normalized field label to a profile attribute (for example,
        &quot;boards.example.com&quot; + &quot;linkedin profile&quot; → LinkedIn URL). This cache contains no personal
        data and is not linked to your account.
      </p>
      <h3>Operational data</h3>
      <p>
        We keep short-lived per-account usage counters to rate-limit AI features. Our hosting provider records standard
        request logs (such as IP address, user agent, and timestamps) for security and reliability. We do not use
        advertising or third-party analytics trackers.
      </p>

      <h2>How the Chrome extension uses its permissions</h2>
      <ul>
        <li>
          <strong>Access to all websites (host permission) and content script:</strong> to recognize job application
          forms on any careers site. Detection runs locally in your browser; page content is not sent to us unless you
          use a feature described above (autofill or resume tailoring).
        </li>
        <li>
          <strong>scripting:</strong> to read the form fields on the current page and fill them with your
          profile when you click Autofill (or when you turn on auto-continue for multi-step forms).
        </li>
        <li>
          <strong>storage and cookies:</strong> to keep you signed in and to sync your session with the {SITE_NAME} web
          app (required by our authentication provider, Clerk).
        </li>
        <li>
          <strong>sidePanel:</strong> to show the {SITE_NAME} panel next to the page you are applying on.
        </li>
        <li>
          <strong>downloads:</strong> to save a generated resume PDF to your computer so you can attach it to the
          application.
        </li>
      </ul>
      <p>
        The use of information received from Chrome extension APIs adheres to the{" "}
        <a href="https://developer.chrome.com/docs/webstore/program-policies/user-data-faq">
          Chrome Web Store User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>

      <h2>How we use your data</h2>
      <ul>
        <li>
          To provide the service: store your profile, fill in forms you choose to fill, generate tailored resumes, and
          track applications.
        </li>
        <li>To keep the service secure and reliable, including rate limiting and abuse prevention.</li>
      </ul>
      <p>We do not sell your personal data, and we do not use it for advertising.</p>

      <h2>AI processing (Google Gemini)</h2>
      <p>Some features send data to Google&apos;s Gemini API for processing:</p>
      <ul>
        <li>
          <strong>Resume parsing:</strong> the text extracted from a resume you upload.
        </li>
        <li>
          <strong>Resume tailoring:</strong> the job description plus your profile&apos;s summary, work experience
          (companies, titles, bullet points), and skill names.
        </li>
        <li>
          <strong>Autofill matching:</strong> form field descriptions only (labels, names, placeholders, types, options)
          — not your profile values.
        </li>
      </ul>
      <p>
        Google processes this data under the{" "}
        <a href="https://ai.google.dev/gemini-api/terms">Gemini API Additional Terms of Service</a> and the{" "}
        <a href="https://policies.google.com/privacy">Google Privacy Policy</a>. Depending on the API tier in use,
        Google&apos;s terms may permit it to use submitted content to improve its products. AI output can be inaccurate
        — always review autofilled answers and generated resumes before submitting them.
      </p>

      <h2>Where your data is stored (service providers)</h2>
      <ul>
        <li>
          <strong>Clerk</strong> — authentication and account management.
        </li>
        <li>
          <strong>Neon</strong> — PostgreSQL database for your profile, resume content, and application tracker.
        </li>
        <li>
          <strong>Vercel</strong> — hosting of the web app and API, and Vercel Blob private storage for resume files.
        </li>
        <li>
          <strong>Google</strong> — Gemini API for the AI features described above.
        </li>
      </ul>
      <p>
        These providers process data on our behalf and may store it in the United States or other countries. Resume
        files are stored in private storage and are only served to your own signed-in account.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        We keep your data while your account is active. You can edit your profile and delete tracked applications in the
        dashboard at any time. To delete your account and all associated data (profile, resumes, resume files, and
        applications), email us at {CONTACT_EMAIL} and we will delete it within 30 days. Rate-limit counters are deleted
        automatically; the shared autofill cache contains no personal data.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on where you live, you may have the right to access, correct, export, or delete your personal data, or
        to object to certain processing. Contact us at {CONTACT_EMAIL} to make a request.
      </p>

      <h2>Children</h2>
      <p>{SITE_NAME} is not intended for anyone under 16, and we do not knowingly collect their data.</p>

      <h2>Changes</h2>
      <p>
        We will update this page when our practices change and revise the &quot;Last updated&quot; date above. See also
        our <Link href="/terms">Terms of Service</Link>.
      </p>

      <h2>Contact</h2>
      <p>Questions or requests: {CONTACT_EMAIL}</p>
    </LegalPage>
  );
}
