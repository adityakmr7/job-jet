import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { UserRound, KanbanSquare, FileText } from "lucide-react";
import { Logo } from "./Logo";

const NAV = [
  { label: "Profile", icon: UserRound, href: "/dashboard", active: true },
  { label: "Applications", icon: KanbanSquare, soon: true },
  { label: "Tailored resumes", icon: FileText, soon: true },
];

export function DashboardShell({
  title,
  description,
  email,
  children,
}: {
  title: string;
  description: string;
  email: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-surface">
        <div className="px-5 py-5 border-b border-border">
          <Logo size={26} />
        </div>
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
            return (
              <Link
                key={item.label}
                href={item.href!}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium bg-accent-soft text-accent"
              >
                <Icon className="w-4 h-4" strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-border text-xs text-muted truncate">{email}</div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between border-b border-border px-5 py-4">
          <Logo size={24} />
          <UserButton />
        </header>

        <main className="flex-1 px-6 sm:px-10 py-10 max-w-3xl w-full">
          <div className="flex items-start justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="text-sm text-muted mt-1">{description}</p>
            </div>
            <div className="hidden md:block">
              <UserButton />
            </div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
