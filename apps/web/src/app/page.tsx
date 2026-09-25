import { Show } from "@/components/auth/Show";
import {
  ArrowRight,
  ClipboardList,
  FileText,
  Globe,
  Lock,
  MousePointerClick,
  Puzzle,
  ShieldCheck,
  Trash2,
  UserRoundCheck,
  Wand2,
  Zap,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ButtonLink, buttonClasses, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { AutofillMock, HeroMock, TailorMock, TrackerMock } from "@/components/landing/mocks";
import { EXTENSION_URL } from "@/lib/site-config";

const VALUE_PROPS = [
  {
    icon: UserRoundCheck,
    title: "One profile, every form",
    description: "Upload your resume once. Job Jet turns it into a structured profile you can review and edit.",
  },
  {
    icon: Wand2,
    title: "A resume for each role",
    description: "Reword your real experience to match the job post — as a clean PDF, ready to attach.",
  },
  {
    icon: ClipboardList,
    title: "A tracker that fills itself",
    description: "Every job you work on lands in your pipeline automatically, with status and notes.",
  },
];

const STEPS = [
  {
    title: "Build your profile",
    description: "Drop in a PDF or DOCX resume. We parse it into experience, education, skills and links — you fix anything we got wrong.",
  },
  {
    title: "Browse jobs as usual",
    description: "When Job Jet spots an application form, a small launcher appears. Open the side panel from it or the toolbar.",
  },
  {
    title: "Fill, tailor, review, submit",
    description: "Autofill the form, generate a tailored resume for the role, check everything, and hit submit yourself.",
  },
];

const FEATURES = [
  {
    id: "autofill",
    eyebrow: "Autofill",
    title: "Fills the boring 80% of any application",
    description:
      "Job Jet reads the form's labels, not just the website's name, so it works on hosted ATS pages and custom career sites alike. Multi-step forms keep filling as you move through them.",
    points: [
      "Recognises names, contact details, links, education, work authorisation and more",
      "Known-site adapters for Greenhouse, Lever and Ashby, with a smart fallback everywhere else",
      "Skips uploads, voluntary demographic questions and essays, and leaves them for you",
    ],
    mock: <AutofillMock />,
  },
  {
    id: "tailor",
    eyebrow: "Tailored resumes",
    title: "Your experience, in the job post's language",
    description:
      "Generate a version of your resume that puts the most relevant work first and uses the words the hiring team is looking for. You get a PDF in seconds.",
    points: [
      "Rewords only what's already true: same employers, titles, dates and skills",
      "Reorders your skills so the most relevant come first",
      "Saved to your library, linked to the application it was made for",
    ],
    mock: <TailorMock />,
  },
  {
    id: "tracker",
    eyebrow: "Application tracker",
    title: "Know where every application stands",
    description:
      "No spreadsheet to maintain. Anything you autofill or tailor a resume for shows up in your tracker, ready for a status, the resume you sent, and notes.",
    points: [
      "Statuses from in progress to offer",
      "See which resume version went to which company",
      "Notes for recruiter names, follow-ups and interview prep",
    ],
    mock: <TrackerMock />,
  },
];

const TRUST = [
  { icon: MousePointerClick, title: "Never auto-submits", description: "You review every field and press submit yourself." },
  { icon: Lock, title: "Private resume storage", description: "Files sit in private storage and only you can download them." },
  { icon: ShieldCheck, title: "No selling your data", description: "Your profile is used to fill your forms. That's it." },
  { icon: Trash2, title: "Delete anytime", description: "Remove resumes, applications or your whole account whenever you like." },
];

const FAQ = [
  {
    q: "Which job sites does Job Jet work on?",
    a: "Any site with an application form. Job Jet detects forms by their structure and labels, with extra accuracy on Greenhouse, Lever and Ashby. Some heavily customised or iframe-embedded forms may need a bit more manual input.",
  },
  {
    q: "Does it submit applications for me?",
    a: "No, and that's on purpose. Job Jet fills what it can and stops. You always review the form, attach files and press submit yourself.",
  },
  {
    q: "Will a tailored resume make things up?",
    a: "It's built not to. The AI can only reword your existing bullet points and summary, and reorder skills you already listed. Employers, job titles, dates, education and contact details are copied from your profile unchanged.",
  },
  {
    q: "Why can't it attach my resume file?",
    a: "Browsers don't let extensions set file inputs. Job Jet saves the tailored PDF to your Downloads folder, so it's one click to attach.",
  },
  {
    q: "What does it cost?",
    a: "Job Jet is free while it's in beta. Reasonable-use limits apply to the AI features.",
  },
  {
    q: "Which browsers are supported?",
    a: "Google Chrome and other Chromium browsers that support side panels (Chrome 116 or newer).",
  },
];

function InstallButton({
  size = "lg",
  variant = "primary",
  label = "Add to Chrome — it's free",
}: {
  size?: ButtonSize;
  variant?: ButtonVariant;
  label?: string;
}) {
  if (EXTENSION_URL) {
    return (
      <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer" className={buttonClasses({ size, variant })}>
        <Puzzle className="w-4 h-4" aria-hidden />
        {label}
      </a>
    );
  }
  return (
    <ButtonLink href="/sign-up" size={size} variant={variant}>
      <Puzzle className="w-4 h-4" aria-hidden />
      {label}
    </ButtonLink>
  );
}

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-grid pointer-events-none" aria-hidden />
          <div
            className="absolute -top-40 right-[-10%] w-[40rem] h-[40rem] rounded-full bg-accent/15 blur-[120px] pointer-events-none"
            aria-hidden
          />
          <div className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-14 sm:pt-20 pb-20 grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[1.05fr_1fr] gap-14 items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted shadow-[var(--shadow-card)]">
                <Zap className="w-3.5 h-3.5 text-flare" aria-hidden />
                Free during beta · Chrome extension
              </p>
              <h1 className="mt-6 text-[2.6rem] leading-[1.05] sm:text-6xl font-semibold tracking-[-0.035em] text-balance">
                Apply in minutes,
                <br />
                <span className="text-accent">not evenings.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted text-pretty">
                Job Jet reads the application form you&apos;re on, fills it from your profile, and rewrites your
                resume for that exact role. You review it and you press submit.
              </p>
              <div className="mt-9 flex flex-col sm:flex-row gap-3">
                <Show when="signed-out">
                  <InstallButton />
                  <ButtonLink href="#how-it-works" variant="secondary" size="lg">
                    See how it works
                  </ButtonLink>
                </Show>
                <Show when="signed-in">
                  <ButtonLink href="/dashboard" size="lg">
                    Open your dashboard <ArrowRight className="w-4 h-4" aria-hidden />
                  </ButtonLink>
                  <InstallButton variant="secondary" label="Get the extension" />
                </Show>
              </div>
              <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
                <li className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-accent" aria-hidden /> Works on any careers site
                </li>
                <li className="flex items-center gap-2">
                  <MousePointerClick className="w-4 h-4 text-accent" aria-hidden /> Never auto-submits
                </li>
                <li className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-accent" aria-hidden /> PDF resumes in seconds
                </li>
              </ul>
            </div>
            <HeroMock />
          </div>
        </section>

        {/* Value props */}
        <section aria-label="Why Job Jet" className="border-y border-border bg-surface">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 py-12 grid gap-8 md:grid-cols-3">
            {VALUE_PROPS.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex gap-4">
                <div className="shrink-0 w-11 h-11 rounded-[var(--radius-md)] bg-accent-soft text-accent flex items-center justify-center">
                  <Icon className="w-5 h-5" aria-hidden />
                </div>
                <div>
                  <h2 className="font-semibold">{title}</h2>
                  <p className="mt-1 text-sm text-muted leading-relaxed">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20 max-w-6xl mx-auto px-5 sm:px-8 py-24">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-accent">How it works</p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight text-balance">
              Set up once. Then every application is a quick review.
            </h2>
          </div>
          <ol className="mt-12 grid gap-5 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="relative rounded-[var(--radius-xl)] border border-border bg-surface p-6 shadow-[var(--shadow-card)]"
              >
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-ink text-white text-sm font-semibold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="contrail h-0.5 flex-1 rounded-full opacity-60" aria-hidden />
                </div>
                <h3 className="mt-5 font-semibold text-lg">{step.title}</h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">{step.description}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Feature deep-dives */}
        <section id="features" className="scroll-mt-20 bg-surface border-y border-border">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 py-24 space-y-24">
            {FEATURES.map((f, i) => (
              <div key={f.id} id={f.id} className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-2 gap-12 items-center">
                <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                  <p className="text-sm font-semibold text-accent">{f.eyebrow}</p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance">{f.title}</h2>
                  <p className="mt-4 text-muted leading-relaxed">{f.description}</p>
                  <ul className="mt-6 space-y-3">
                    {f.points.map((p) => (
                      <li key={p} className="flex gap-3 text-sm">
                        <span className="mt-1 w-4 h-4 shrink-0 rounded-full bg-accent-soft flex items-center justify-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                        </span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={i % 2 === 1 ? "lg:order-1" : ""}>{f.mock}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Trust */}
        <section aria-labelledby="trust-heading" className="bg-ink text-white">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20">
            <h2 id="trust-heading" className="text-3xl font-semibold tracking-tight max-w-xl text-balance">
              You stay in the pilot&apos;s seat.
            </h2>
            <p className="mt-3 text-white/70 max-w-xl">
              Job Jet speeds up the typing, not the decisions. Here&apos;s what it will and won&apos;t do.
            </p>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {TRUST.map(({ icon: Icon, title, description }) => (
                <div key={title} className="rounded-[var(--radius-lg)] border border-white/10 bg-white/5 p-5">
                  <Icon className="w-5 h-5 text-flare" aria-hidden />
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm text-white/70 leading-relaxed">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 max-w-3xl mx-auto px-5 sm:px-8 py-24">
          <h2 className="text-3xl font-semibold tracking-tight text-center">Questions, answered</h2>
          <div className="mt-10 divide-y divide-border rounded-[var(--radius-xl)] border border-border bg-surface shadow-[var(--shadow-card)]">
            {FAQ.map((item) => (
              <details key={item.q} className="group px-6 py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span
                    className="shrink-0 w-6 h-6 rounded-full bg-surface-hover text-muted flex items-center justify-center text-lg leading-none transition-transform group-open:rotate-45"
                    aria-hidden
                  >
                    +
                  </span>
                </summary>
                <p className="pb-5 -mt-1 text-sm text-muted leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Install CTA */}
        <section className="px-5 sm:px-8 pb-24">
          <div className="relative overflow-hidden max-w-6xl mx-auto rounded-[2rem] bg-gradient-to-br from-[#3a4cf0] to-[#1c2699] px-8 py-14 sm:px-14 text-white shadow-[var(--shadow-popover)]">
            <div className="absolute -right-16 -top-16 w-72 h-72 rounded-full bg-white/10 blur-2xl" aria-hidden />
            <div className="absolute left-0 bottom-0 w-2/3 h-1 contrail opacity-80" aria-hidden />
            <div className="relative grid gap-8 lg:grid-cols-[1.4fr_1fr] items-center">
              <div>
                <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-balance">
                  Your next application could take five minutes.
                </h2>
                <p className="mt-3 text-white/80 max-w-lg">
                  Install the extension, upload your resume, and open any job post. That&apos;s the whole setup.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row lg:flex-col gap-3 lg:items-end">
                <InstallButton variant="inverse" />
                <Show when="signed-out">
                  <ButtonLink href="/sign-in" variant="ghost" size="lg" className="text-white/85 hover:text-white hover:bg-white/10">
                    I already have an account
                  </ButtonLink>
                </Show>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
