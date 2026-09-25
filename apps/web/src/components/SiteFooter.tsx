import Link from "next/link";
import { Logo } from "./Logo";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/#features", label: "Features" },
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#faq", label: "FAQ" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/sign-up", label: "Create account" },
      { href: "/sign-in", label: "Sign in" },
      { href: "/dashboard", label: "Dashboard" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms of service" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-12 grid gap-10 sm:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-3">
          <Logo size={26} />
          <p className="text-sm text-muted max-w-xs">
            The job-application copilot that fills the form, tailors the resume, and keeps score — while you stay in
            charge of what gets sent.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title} className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">{col.title}</h2>
            <ul className="space-y-2">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-muted hover:text-foreground transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-5 flex flex-col sm:flex-row gap-2 justify-between text-xs text-muted">
          <p>© {new Date().getFullYear()} Job Jet. All rights reserved.</p>
          <p>Job Jet never submits an application for you.</p>
        </div>
      </div>
    </footer>
  );
}
