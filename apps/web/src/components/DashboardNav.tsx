"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRound, KanbanSquare, FileText } from "lucide-react";

type NavItem = { label: string; icon: typeof UserRound; href: string; soon?: boolean };

const NAV: NavItem[] = [
  { label: "Profile", icon: UserRound, href: "/dashboard" },
  { label: "Applications", icon: KanbanSquare, href: "/dashboard/applications" },
  { label: "Tailored resumes", icon: FileText, href: "", soon: true },
];

export function DashboardNav({ variant = "sidebar" }: { variant?: "sidebar" | "tabs" }) {
  const pathname = usePathname();

  if (variant === "tabs") {
    return (
      <nav aria-label="Dashboard" className="flex gap-1 px-3 pb-2 overflow-x-auto">
        {NAV.filter((item) => !item.soon).map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                active ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground hover:bg-surface-hover"
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="Dashboard" className="flex-1 px-3 py-4 flex flex-col gap-1">
      <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Workspace</p>
      {NAV.map((item) => {
        const Icon = item.icon;
        if (item.soon) {
          return (
            <div
              key={item.label}
              aria-disabled="true"
              className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm text-muted/80 cursor-not-allowed"
            >
              <span className="flex items-center gap-3">
                <Icon className="w-4 h-4" aria-hidden />
                {item.label}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide rounded-full bg-flare-soft text-[#b8431a] px-1.5 py-0.5">
                Soon
              </span>
            </div>
          );
        }
        const active = pathname === item.href;
        return (
          <Link
            key={item.label}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-colors ${
              active ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            {active && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-accent" aria-hidden />}
            <Icon className="w-4 h-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
