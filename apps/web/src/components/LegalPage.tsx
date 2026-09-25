import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { LEGAL_LAST_UPDATED } from "@/lib/site-config";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1 px-5 sm:px-8 py-14 sm:py-20">
        <article className="max-w-3xl mx-auto rounded-[var(--radius-xl)] border border-border bg-surface px-6 py-10 sm:px-12 sm:py-14 shadow-[var(--shadow-card)] space-y-6 text-[15px] leading-7 text-foreground [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:mt-12 [&_h2]:mb-2 [&_h3]:font-semibold [&_h3]:mt-6 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1.5 [&_ul]:marker:text-accent [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-accent-hover">
          <header className="space-y-3 pb-6 border-b border-border">
            <p className="text-sm font-semibold text-accent">Legal</p>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted">Last updated: {LEGAL_LAST_UPDATED}</p>
          </header>
          {children}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
