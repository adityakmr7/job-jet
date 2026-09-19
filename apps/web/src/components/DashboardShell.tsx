import { UserButton } from "@clerk/nextjs";
import { Logo } from "./Logo";
import { DashboardNav } from "./DashboardNav";

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
        <DashboardNav />
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
