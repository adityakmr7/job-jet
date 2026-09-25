import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The terms that apply to using ${SITE_NAME}.`,
};

// NOTE(owner): review this text before publishing (and add a governing-law
// clause appropriate for you if desired), and set NEXT_PUBLIC_CONTACT_EMAIL.
export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms govern your use of the {SITE_NAME} web app and Chrome extension (the &quot;Service&quot;). By using
        the Service you agree to them. If you do not agree, do not use the Service.
      </p>

      <h2>The Service</h2>
      <p>
        {SITE_NAME} helps you store a professional profile, autofill job application forms, generate resumes tailored to
        job descriptions using AI, and track the applications you work on. Features may change, and the Service may be
        unavailable from time to time.
      </p>

      <h2>Your account</h2>
      <p>
        You are responsible for your account and for keeping your sign-in credentials secure. You must provide accurate
        information and be at least 16 years old to use the Service.
      </p>

      <h2>Your content and responsibility for applications</h2>
      <ul>
        <li>
          You keep ownership of the information and files you provide. You grant us the permission needed to store and
          process them to operate the Service, as described in our <Link href="/privacy">Privacy Policy</Link>.
        </li>
        <li>
          Autofill and AI-generated content can be wrong or incomplete. You are solely responsible for reviewing every
          application and resume before you submit it, and for the accuracy of anything submitted under your name.
        </li>
        <li>Only provide information you have the right to share, and only apply using truthful information.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>use the Service to submit applications in bulk, spam employers, or violate any website&apos;s terms;</li>
        <li>
          attempt to access other users&apos; data, probe or disrupt the Service, or bypass rate limits or security
          measures;
        </li>
        <li>
          reverse engineer the hosted Service beyond what applicable law or the open-source license of its code allows;
        </li>
        <li>use the Service for anything unlawful.</li>
      </ul>
      <p>We may suspend or terminate access for violations of these terms.</p>

      <h2>Third-party services</h2>
      <p>
        The Service relies on third parties including Clerk (authentication), Neon (database), Vercel (hosting and file
        storage), and Google Gemini (AI processing). Their availability and terms are outside our control.
      </p>

      <h2>Open-source code</h2>
      <p>
        The source code of {SITE_NAME} is available under the MIT License. That license covers the code; these terms
        cover use of the hosted Service.
      </p>

      <h2>Disclaimer</h2>
      <p>
        The Service is provided &quot;as is&quot; and &quot;as available&quot;, without warranties of any kind, express
        or implied, including merchantability, fitness for a particular purpose, and non-infringement. We do not
        guarantee any job application outcome.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, we will not be liable for any indirect, incidental, special,
        consequential, or punitive damages, or any loss of data, opportunities, or profits, arising from your use of the
        Service.
      </p>

      <h2>Changes and termination</h2>
      <p>
        We may update these terms; the &quot;Last updated&quot; date above will change when we do, and continued use
        means you accept the updated terms. You may stop using the Service at any time and request deletion of your data
        as described in the Privacy Policy.
      </p>

      <h2>Contact</h2>
      <p>Questions about these terms: {CONTACT_EMAIL}</p>
    </LegalPage>
  );
}
