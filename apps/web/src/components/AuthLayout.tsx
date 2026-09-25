import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { Logo } from "./Logo";

const POINTS = [
  "Autofill applications on any careers site",
  "Tailored resume PDFs in seconds",
  "A tracker that updates itself",
];

/** Split-screen shell for Clerk's sign-in / sign-up widgets. */
export function AuthLayout({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="flex-1 grid lg:grid-cols-2">
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-ink text-white p-12">
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-accent/40 blur-3xl" aria-hidden />
        <div className="absolute left-0 bottom-32 w-3/4 h-1 contrail opacity-80" aria-hidden />
        <div className="relative text-white">
          <Logo size={30} inverted />
        </div>
        <div className="relative max-w-md">
          <h1 className="text-4xl font-semibold tracking-tight text-balance">{title}</h1>
          <ul className="mt-8 space-y-4">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-3 text-white/85">
                <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-flare" aria-hidden />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/60">Job Jet never submits an application for you.</p>
      </div>
      <main id="main" className="relative flex flex-col items-center justify-center px-4 py-12 overflow-hidden">
        <div className="absolute inset-0 bg-grid pointer-events-none" aria-hidden />
        <div className="relative mb-8 lg:hidden">
          <Logo size={32} />
        </div>
        <div className="relative">{children}</div>
      </main>
    </div>
  );
}
