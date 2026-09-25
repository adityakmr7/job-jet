import type { ComponentProps, ReactNode } from "react";

export const inputClasses =
  "w-full rounded-[var(--radius-md)] border border-border-strong bg-surface px-3.5 py-2.5 text-sm text-foreground " +
  "transition-colors placeholder:text-muted/80 hover:border-muted/60 " +
  "focus:outline-none focus-visible:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent " +
  "disabled:bg-surface-sunken disabled:text-muted disabled:cursor-not-allowed";

export const selectClasses = `${inputClasses} appearance-none pr-9 bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23555c78' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")] bg-no-repeat bg-[right_0.75rem_center]`;

/** Visible label + control + optional hint, wired together for screen readers. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
  className = "",
  required,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  required?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-foreground">
        {label}
        {required && (
          <span className="text-danger ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${inputClasses} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea className={`${inputClasses} resize-y ${className}`} {...props} />;
}
