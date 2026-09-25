import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { LEGAL_LAST_UPDATED } from "@/lib/site-config";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 px-6 py-16">
        <article className="max-w-3xl mx-auto space-y-6 text-[15px] leading-7 text-foreground [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-10 [&_h2]:mb-2 [&_h3]:font-semibold [&_h3]:mt-6 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_a]:text-accent [&_a]:underline">
          <header className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted">Last updated: {LEGAL_LAST_UPDATED}</p>
          </header>
          {children}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
