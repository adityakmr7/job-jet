import Link from "next/link";
import { Show } from "@clerk/nextjs";
import { Sparkles, MousePointerClick, FileStack, ShieldCheck } from "lucide-react";
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
        <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-balance">
            Stop retyping your resume into every job application.
          </h1>
          <p className="mt-5 max-w-xl mx-auto text-lg opacity-70 text-balance">
            Job Jet is a Chrome extension that recognizes application forms anywhere on the
            web and fills them from a profile you set up once — or generates a resume
            tailored to the exact job description.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Show when="signed-out">
              <Link
                href="/sign-up"
                className="rounded-full bg-violet-700 text-white px-6 py-3 text-sm font-semibold hover:bg-violet-800 transition-colors"
              >
                Get started free
              </Link>
              <a href="#how-it-works" className="text-sm font-medium opacity-70 hover:opacity-100">
                See how it works
              </a>
            </Show>
            <Show when="signed-in">
              <Link
                href="/dashboard"
                className="rounded-full bg-violet-700 text-white px-6 py-3 text-sm font-semibold hover:bg-violet-800 transition-colors"
              >
                Go to your dashboard
              </Link>
            </Show>
          </div>

          {/* Lightweight illustrative mockup — no screenshots needed */}
          <div className="mt-16 mx-auto max-w-2xl rounded-2xl border border-black/[.08] dark:border-white/[.1] shadow-sm overflow-hidden text-left">
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-black/[.06] dark:border-white/[.08] bg-black/[.02] dark:bg-white/[.03]">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
              <span className="ml-3 text-xs opacity-50">acmecorp.com/careers/apply</span>
            </div>
            <div className="relative p-6 space-y-3 bg-background">
              <div className="h-3 w-2/3 rounded bg-black/[.08] dark:bg-white/[.12]" />
              <div className="h-8 rounded-lg border border-black/[.08] dark:border-white/[.12]" />
              <div className="h-8 rounded-lg border border-black/[.08] dark:border-white/[.12]" />
              <div className="h-16 rounded-lg border border-black/[.08] dark:border-white/[.12]" />
              <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-violet-700 text-white text-xs font-semibold px-4 py-2.5 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                Fill with Job Jet
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="max-w-5xl mx-auto px-6 py-16 border-t border-black/[.06] dark:border-white/[.08]">
          <div className="grid sm:grid-cols-2 gap-8">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex gap-4">
                <div className="shrink-0 w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-violet-700 dark:text-violet-400" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{title}</h3>
                  <p className="text-sm opacity-70 leading-relaxed">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="max-w-5xl mx-auto px-6 py-16 border-t border-black/[.06] dark:border-white/[.08]">
          <h2 className="text-2xl font-semibold text-center mb-12">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-10">
            {STEPS.map((step, i) => (
              <div key={step.title} className="text-center sm:text-left">
                <div className="w-8 h-8 rounded-full bg-violet-700 text-white text-sm font-semibold flex items-center justify-center mb-4 mx-auto sm:mx-0">
                  {i + 1}
                </div>
                <h3 className="font-semibold mb-1">{step.title}</h3>
                <p className="text-sm opacity-70 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="max-w-5xl mx-auto px-6 py-20 border-t border-black/[.06] dark:border-white/[.08] text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold mb-4">Ready to stop copy-pasting your resume?</h2>
          <Show when="signed-out">
            <Link
              href="/sign-up"
              className="inline-block rounded-full bg-violet-700 text-white px-6 py-3 text-sm font-semibold hover:bg-violet-800 transition-colors"
            >
              Get started free
            </Link>
          </Show>
          <Show when="signed-in">
            <Link
              href="/dashboard"
              className="inline-block rounded-full bg-violet-700 text-white px-6 py-3 text-sm font-semibold hover:bg-violet-800 transition-colors"
            >
              Go to your dashboard
            </Link>
          </Show>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
