import type { ReactNode } from "react";

/** The form card on auth pages: heading, optional lead, body, footer. */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="w-full">
      <div className="rounded-[var(--radius-xl)] border border-border bg-surface p-6 sm:p-8 shadow-[var(--shadow-card-hover)]">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-2 text-sm text-muted leading-relaxed">{description}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
    </div>
  );
}

export function Divider({ label = "or" }: { label?: string }) {
  return (
    <div className="my-5 flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-muted" role="separator">
      <span className="h-px flex-1 bg-border" />
      {label}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
