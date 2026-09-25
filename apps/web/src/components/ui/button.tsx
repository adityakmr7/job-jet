import Link from "next/link";
import type { ComponentProps } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "inverse";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-all " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:opacity-50 disabled:pointer-events-none aria-disabled:opacity-50 aria-disabled:pointer-events-none";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-foreground shadow-[var(--shadow-glow)] hover:bg-accent-hover active:scale-[0.98]",
  secondary:
    "bg-surface text-foreground border border-border-strong shadow-[var(--shadow-card)] hover:bg-surface-hover active:scale-[0.98]",
  ghost: "text-muted hover:text-foreground hover:bg-surface-hover",
  danger: "text-danger hover:bg-danger-soft",
  inverse: "bg-white text-ink hover:bg-white/90 active:scale-[0.98]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3.5 text-xs",
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-7 text-[15px]",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  className = "",
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`;
}

type Common = { variant?: ButtonVariant; size?: ButtonSize };

export function Button({ variant, size, className, type = "button", ...props }: ComponentProps<"button"> & Common) {
  return <button type={type} className={buttonClasses({ variant, size, className })} {...props} />;
}

export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & Common) {
  return <Link className={buttonClasses({ variant, size, className })} {...props} />;
}
