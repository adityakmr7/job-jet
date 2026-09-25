import type { ComponentProps, ReactNode } from "react";

export function Card({ className = "", ...props }: ComponentProps<"section">) {
  return (
    <section
      className={`rounded-[var(--radius-lg)] border border-border bg-surface p-5 sm:p-6 shadow-[var(--shadow-card)] ${className}`}
      {...props}
    />
  );
}

/** Card header row: title (+ optional description) on the left, actions on the right. */
export function CardHeader({
  title,
  description,
  icon,
  action,
  id,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <div className="shrink-0 w-9 h-9 rounded-[var(--radius-md)] bg-accent-soft text-accent flex items-center justify-center">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h2 id={id} className="text-[15px] font-semibold tracking-tight">
            {title}
          </h2>
          {description && <p className="text-sm text-muted mt-0.5">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
