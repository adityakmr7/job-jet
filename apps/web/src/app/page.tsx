import Link from "next/link";
import { Show } from "@clerk/nextjs";
import { Sparkles, MousePointerClick, FileStack, ShieldCheck, ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const FEATURES = [
  {
    icon: MousePointerClick,
    title: "Works on any job site",
    description:
      "No fixed list of supported portals. Job Jet recognizes application forms by how they look, not just which domain they're on — Greenhouse, Lever, Workday, or a company's own careers page.",
  },
  {
    icon: Sparkles,
    title: "AI-tailored resumes",
    description:
      "Upload one resume. For any job description, generate a version reworded and reordered to match it — as a downloadable PDF, in seconds.",
  },
  {
    icon: FileStack,
    title: "Fill your profile once",
    description:
      "Your experience, education, links, and the questions every application asks (work authorization, sponsorship) — saved once, reused everywhere.",
  },
  {
    icon: ShieldCheck,
    title: "You stay in control",
    description:
      "Job Jet fills what it can and leaves the rest for you — file uploads and personal questions always need your review before you submit.",
  },
];

const STEPS = [
  {
    title: "Upload your resume",
    description: "We parse it into structured data — no manual form-filling to set up.",
  },
  {
    title: "Browse job sites like normal",
    description: "A floating button appears the moment Job Jet recognizes an application form.",
  },
  {
    title: "Autofill or tailor a resume",
    description: "One click fills the form from your profile, or generates a resume matched to the job.",
  },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-grid pointer-events-none" aria-hidden />
          <div
            className="absolute -top-24 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full bg-accent/20 blur-[110px] pointer-events-none"
            aria-hidden
          />
          <div className="relative max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-medium text-muted shadow-[var(--shadow-card)]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Free while in beta
            </div>

            <h1 className="mt-6 text-4xl sm:text-6xl font-semibold tracking-tight text-balance">
              Stop retyping your resume<br className="hidden sm:block" /> into every job application.
            </h1>
            <p className="mt-5 max-w-xl mx-auto text-lg text-muted text-balance">
              Job Jet is a Chrome extension that recognizes application forms anywhere on the
              web and fills them from a profile you set up once — or generates a resume
              tailored to the exact job description.
            </p>
            <div className="mt-9 flex items-center justify-center gap-4">
              <Show when="signed-out">
                <Link
                  href="/sign-up"
                  className="group inline-flex items-center gap-1.5 rounded-full bg-accent text-accent-foreground px-6 py-3 text-sm font-semibold shadow-[var(--shadow-card)] hover:bg-accent-hover hover:shadow-[var(--shadow-card-hover)] transition-all"
                >
                  Get started free
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <a href="#how-it-works" className="text-sm font-medium text-muted hover:text-foreground transition-colors">
                  See how it works
                </a>
              </Show>
              <Show when="signed-in">
                <Link
                  href="/dashboard"
                  className="group inline-flex items-center gap-1.5 rounded-full bg-accent text-accent-foreground px-6 py-3 text-sm font-semibold shadow-[var(--shadow-card)] hover:bg-accent-hover hover:shadow-[var(--shadow-card-hover)] transition-all"
                >
                  Go to your dashboard
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Show>
            </div>

            {/* Lightweight illustrative mockup — no screenshots needed */}
            <div className="mt-16 mx-auto max-w-2xl rounded-2xl border border-border bg-surface shadow-[var(--shadow-popover)] overflow-hidden text-left">
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border bg-surface-hover">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
                <span className="ml-3 text-xs text-muted">acmecorp.com/careers/apply</span>
              </div>
              <div className="relative p-6 space-y-3">
                <div className="h-3 w-2/3 rounded bg-surface-hover" />
                <div className="h-8 rounded-lg border border-border" />
                <div className="h-8 rounded-lg border border-border" />
                <div className="h-16 rounded-lg border border-border" />
                <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-accent text-accent-foreground text-xs font-semibold px-4 py-2.5 shadow-[var(--shadow-popover)]">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Fill with Job Jet
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="max-w-5xl mx-auto px-6 py-20 border-t border-border">
          <div className="grid sm:grid-cols-2 gap-6">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="group flex gap-4 rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5"
              >
                <div className="shrink-0 w-11 h-11 rounded-xl bg-accent-soft flex items-center justify-center transition-colors group-hover:bg-accent group-hover:[&>svg]:text-accent-foreground">
                  <Icon className="w-5 h-5 text-accent" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="font-semibold mb-1.5">{title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="max-w-5xl mx-auto px-6 py-20 border-t border-border">
          <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-14 tracking-tight">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-10 relative">
            <div className="hidden sm:block absolute top-5 left-[16.5%] right-[16.5%] h-px bg-border" aria-hidden />
            {STEPS.map((step, i) => (
              <div key={step.title} className="relative text-center sm:text-left">
                <div className="relative z-10 w-10 h-10 rounded-full bg-accent text-accent-foreground text-sm font-semibold flex items-center justify-center mb-5 mx-auto sm:mx-0 shadow-[var(--shadow-card)]">
                  {i + 1}
                </div>
                <h3 className="font-semibold mb-1.5">{step.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative overflow-hidden border-t border-border">
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[36rem] h-[24rem] rounded-full bg-accent/15 blur-[110px] pointer-events-none"
            aria-hidden
          />
          <div className="relative max-w-5xl mx-auto px-6 py-24 text-center">
            <h2 className="text-2xl sm:text-3xl font-semibold mb-5 tracking-tight text-balance">
              Ready to stop copy-pasting your resume?
            </h2>
            <Show when="signed-out">
              <Link
                href="/sign-up"
                className="group inline-flex items-center gap-1.5 rounded-full bg-accent text-accent-foreground px-6 py-3 text-sm font-semibold shadow-[var(--shadow-card)] hover:bg-accent-hover hover:shadow-[var(--shadow-card-hover)] transition-all"
              >
                Get started free
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Show>
            <Show when="signed-in">
              <Link
                href="/dashboard"
                className="group inline-flex items-center gap-1.5 rounded-full bg-accent text-accent-foreground px-6 py-3 text-sm font-semibold shadow-[var(--shadow-card)] hover:bg-accent-hover hover:shadow-[var(--shadow-card-hover)] transition-all"
              >
                Go to your dashboard
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Show>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
