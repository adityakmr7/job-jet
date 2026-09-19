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

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
      {NAV.map((item) => {
        const Icon = item.icon;
        if (item.soon) {
          return (
            <div
              key={item.label}
              className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-muted cursor-not-allowed"
            >
              <span className="flex items-center gap-3">
                <Icon className="w-4 h-4" strokeWidth={2} />
                {item.label}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wide rounded-full border border-border px-1.5 py-0.5">
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
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            <Icon className="w-4 h-4" strokeWidth={2} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
