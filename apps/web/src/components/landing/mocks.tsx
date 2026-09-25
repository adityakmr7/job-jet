import { Check, FileText, Sparkles, Wand2 } from "lucide-react";
import { LogoMark } from "../Logo";

/**
 * Illustrative product mock-ups for the landing page, built from plain
 * markup (no screenshots to keep in sync). Purely decorative: hidden from
 * assistive tech, since the surrounding copy says the same thing.
 */

function BrowserChrome({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-xl)] border border-border bg-surface shadow-[var(--shadow-popover)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 h-10 border-b border-border bg-surface-sunken">
        <span className="w-2.5 h-2.5 rounded-full bg-border-strong" />
        <span className="w-2.5 h-2.5 rounded-full bg-border-strong" />
        <span className="w-2.5 h-2.5 rounded-full bg-border-strong" />
        <span className="ml-3 flex-1 max-w-72 rounded-full bg-surface border border-border px-3 py-1 text-[11px] text-muted truncate">
          {url}
        </span>
      </div>
      {children}
    </div>
  );
}

function FilledField({ label, value, delay = 0 }: { label: string; value: string; delay?: number }) {
  return (
    <div className="space-y-1" style={{ animationDelay: `${delay}ms` }}>
      <div className="text-[10px] font-medium text-muted">{label}</div>
      <div className="h-8 rounded-md border border-accent/40 bg-accent-soft/60 px-2.5 flex items-center text-[11px] text-foreground">
        {value}
      </div>
    </div>
  );
}

function EmptyField({ label }: { label: string }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-medium text-muted">{label}</div>
      <div className="h-8 rounded-md border border-dashed border-border-strong" />
    </div>
  );
}

export function HeroMock() {
  return (
    <div aria-hidden="true" className="relative select-none">
      <BrowserChrome url="careers.northwind.io/jobs/frontend-engineer/apply">
        <div className="grid grid-cols-[minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_190px] min-h-[330px]">
          <div className="p-5 space-y-3">
            <div className="text-[13px] font-semibold">Frontend Engineer · Apply</div>
            <div className="grid grid-cols-2 gap-2.5">
              <FilledField label="First name" value="Priya" />
              <FilledField label="Last name" value="Sharma" />
            </div>
            <FilledField label="Email" value="priya.sharma@example.com" />
            <FilledField label="LinkedIn profile" value="linkedin.com/in/priyasharma" />
            <div className="grid grid-cols-2 gap-2.5">
              <FilledField label="Authorized to work?" value="Yes" />
              <EmptyField label="Salary expectation" />
            </div>
            <div className="space-y-1">
              <div className="text-[10px] font-medium text-muted">Resume</div>
              <div className="h-8 rounded-md border border-border bg-surface-sunken px-2.5 flex items-center gap-1.5 text-[11px] text-muted">
                <FileText className="w-3 h-3" /> Priya Sharma – Northwind.pdf
              </div>
            </div>
          </div>
          <div className="hidden sm:block border-l border-border bg-background p-3 space-y-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold">
              <LogoMark size={16} /> Job Jet
            </div>
            <div className="rounded-lg bg-surface border border-border p-2.5 space-y-2">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-muted">This page</div>
              <div className="text-[18px] font-semibold leading-none">
                12<span className="text-[11px] text-muted font-medium"> / 14 filled</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-hover overflow-hidden">
                <div className="h-full w-[86%] rounded-full bg-accent" />
              </div>
              <div className="rounded-md bg-accent text-white text-[10px] font-semibold text-center py-1.5">Autofill</div>
            </div>
            <div className="rounded-lg bg-surface border border-border p-2.5 space-y-1.5">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-muted">Skill match</div>
              <div className="flex flex-wrap gap-1">
                {["React", "TypeScript", "a11y", "Next.js"].map((s) => (
                  <span key={s} className="rounded-full bg-success-soft text-success text-[9px] font-semibold px-1.5 py-0.5">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </BrowserChrome>
      <div className="absolute -bottom-5 -left-4 sm:-left-8 flex items-center gap-2 rounded-full bg-ink text-white pl-2 pr-4 py-2 text-xs font-semibold shadow-[var(--shadow-popover)]">
        <span className="w-6 h-6 rounded-full bg-success flex items-center justify-center">
          <Check className="w-3.5 h-3.5" />
        </span>
        Filled 12 fields in 2.1s
      </div>
    </div>
  );
}

export function AutofillMock() {
  const rows = [
    { label: "Full name", value: "Priya Sharma", source: "Profile" },
    { label: "Phone", value: "+1 415 555 0192", source: "Profile" },
    { label: "Portfolio URL", value: "priya.dev", source: "Profile" },
    { label: "Will you need sponsorship?", value: "No", source: "Smart match" },
    { label: "Gender (voluntary)", value: "Left for you", source: "Skipped" },
  ];
  return (
    <div aria-hidden="true" className="rounded-[var(--radius-xl)] border border-border bg-surface p-5 shadow-[var(--shadow-card-hover)] space-y-2.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-background px-3.5 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-muted">{r.label}</div>
            <div className={`text-sm font-medium truncate ${r.source === "Skipped" ? "text-muted italic" : ""}`}>{r.value}</div>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              r.source === "Skipped"
                ? "bg-surface-hover text-muted"
                : r.source === "Smart match"
                  ? "bg-flare-soft text-[#b8431a]"
                  : "bg-accent-soft text-accent"
            }`}
          >
            {r.source}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TailorMock() {
  return (
    <div aria-hidden="true" className="grid gap-3">
      <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">From the job post</div>
        <p className="text-sm leading-relaxed text-muted">
          …own <mark className="bg-flare-soft text-foreground rounded px-0.5">performance</mark> end to end, ship an{" "}
          <mark className="bg-flare-soft text-foreground rounded px-0.5">accessible design system</mark> in{" "}
          <mark className="bg-flare-soft text-foreground rounded px-0.5">TypeScript</mark>…
        </p>
      </div>
      <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-[var(--shadow-card-hover)]">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Your bullet, reworded</div>
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft text-accent px-2 py-0.5 text-[10px] font-semibold">
            <Wand2 className="w-3 h-3" /> Tailored
          </span>
        </div>
        <p className="text-sm text-muted line-through decoration-border-strong">Built a design system used by 6 product teams</p>
        <p className="text-sm font-medium mt-1.5">
          Built an accessible, TypeScript design system adopted by 6 product teams, improving UI performance
        </p>
        <p className="mt-3 text-[11px] text-muted flex items-center gap-1">
          <Check className="w-3 h-3 text-success" /> Same role, same facts — only the wording changes.
        </p>
      </div>
    </div>
  );
}

export function TrackerMock() {
  const cols = [
    { title: "In progress", tone: "bg-accent", items: ["Product Engineer · Ashby"] },
    { title: "Applied", tone: "bg-[#6366f1]", items: ["Platform Eng · Lever", "Frontend · Northwind"] },
    { title: "Interviewing", tone: "bg-flare", items: ["Senior FE · Greenhouse"] },
    { title: "Offer", tone: "bg-success", items: ["Staff Eng · Acme"] },
  ];
  return (
    <div aria-hidden="true" className="grid grid-cols-2 gap-3">
      {cols.map((c) => (
        <div key={c.title} className="rounded-[var(--radius-lg)] border border-border bg-surface-sunken p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold">
            <span className={`w-2 h-2 rounded-full ${c.tone}`} />
            {c.title}
            <span className="text-muted font-medium">{c.items.length}</span>
          </div>
          {c.items.map((i) => (
            <div key={i} className="rounded-md bg-surface border border-border px-2.5 py-2 text-[11px] font-medium shadow-[var(--shadow-card)]">
              {i}
            </div>
          ))}
        </div>
      ))}
      <div className="col-span-2 flex items-center gap-2 text-[11px] text-muted">
        <Sparkles className="w-3.5 h-3.5 text-flare" /> Added automatically when you autofill or tailor a resume.
      </div>
    </div>
  );
}
