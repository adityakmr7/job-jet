import { UserButton } from "@clerk/nextjs";
import { Puzzle } from "lucide-react";
import { Logo } from "./Logo";
import { DashboardNav } from "./DashboardNav";
import { EXTENSION_URL } from "@/lib/site-config";

export function DashboardShell({
  title,
  description,
  email,
  actions,
  children,
}: {
  title: string;
  description: string;
  email: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex min-h-screen">
      <aside className="hidden md:block w-64 shrink-0 border-r border-border bg-surface">
        <div className="sticky top-0 h-screen flex flex-col">
        <div className="px-5 h-16 flex items-center border-b border-border">
          <Logo size={26} href="/dashboard" />
        </div>
        <DashboardNav />
        <div className="p-3">
          <div className="rounded-[var(--radius-lg)] bg-ink text-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Puzzle className="w-4 h-4 text-flare" aria-hidden /> Chrome extension
            </div>
            <p className="mt-1.5 text-xs text-white/70 leading-relaxed">
              Autofill and tailoring happen in the side panel, right next to the job post.
            </p>
            {EXTENSION_URL && (
              <a
                href={EXTENSION_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex h-8 items-center rounded-full bg-white px-3 text-xs font-semibold text-ink hover:bg-white/90"
              >
                Add to Chrome
              </a>
            )}
          </div>
        </div>
        <div className="px-5 py-4 border-t border-border flex items-center gap-3">
          <UserButton />
          <span className="text-xs text-muted truncate" title={email}>
            {email}
          </span>
        </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden sticky top-0 z-20 bg-surface/90 backdrop-blur border-b border-border">
          <div className="flex items-center justify-between px-4 h-14">
            <Logo size={24} href="/dashboard" />
            <UserButton />
          </div>
          <DashboardNav variant="tabs" />
        </header>

        <main id="main" className="flex-1 w-full max-w-4xl px-4 sm:px-8 lg:px-12 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight">{title}</h1>
              <p className="text-sm text-muted mt-1.5 max-w-xl">{description}</p>
            </div>
            {actions && <div className="shrink-0">{actions}</div>}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
