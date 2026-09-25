import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, Loader2 } from "lucide-react";

export type AlertTone = "info" | "success" | "error" | "loading";

const alertTones: Record<AlertTone, string> = {
  info: "bg-accent-soft text-accent border-accent/15",
  success: "bg-success-soft text-success border-success/15",
  error: "bg-danger-soft text-danger border-danger/15",
  loading: "bg-surface-hover text-muted border-border",
};

const alertIcons: Record<AlertTone, ReactNode> = {
  info: <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />,
  success: <CircleCheck className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />,
  error: <CircleAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />,
  loading: <Loader2 className="w-4 h-4 shrink-0 mt-0.5 animate-spin" aria-hidden />,
};

/** Inline message. Errors are announced assertively, everything else politely. */
export function Alert({ tone = "info", children, className = "" }: { tone?: AlertTone; children: ReactNode; className?: string }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-[var(--radius-md)] border px-4 py-3 text-sm font-medium ${alertTones[tone]} ${className}`}
    >
      {alertIcons[tone]}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Floating toast, bottom-centre. Render conditionally; the caller owns the timeout. */
export function Toast({ tone = "success", children }: { tone?: Exclude<AlertTone, "loading">; children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 pointer-events-none">
      <div
        role={tone === "error" ? "alert" : "status"}
        className="pointer-events-auto flex items-center gap-2.5 rounded-full bg-ink text-white pl-3.5 pr-5 py-2.5 text-sm font-medium shadow-[var(--shadow-popover)]"
      >
        {tone === "error" ? (
          <CircleAlert className="w-4 h-4 text-[#ff9b85]" aria-hidden />
        ) : (
          <CircleCheck className="w-4 h-4 text-[#6ee7b7]" aria-hidden />
        )}
        {children}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-dashed border-border-strong bg-surface/60 px-6 py-12 text-center">
      <div className="mx-auto mb-4 w-12 h-12 rounded-2xl bg-accent-soft text-accent flex items-center justify-center">{icon}</div>
      <h3 className="font-semibold">{title}</h3>
      {children && <div className="mt-1.5 text-sm text-muted max-w-sm mx-auto">{children}</div>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-[var(--radius-sm)] bg-[linear-gradient(90deg,var(--surface-hover)_25%,var(--surface-sunken)_37%,var(--surface-hover)_63%)] bg-[length:400%_100%] animate-shimmer ${className}`}
    />
  );
}
