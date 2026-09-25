import { Skeleton } from "./ui/feedback";
import { LogoMark } from "./Logo";

/** Route-level loading state for dashboard pages (rendered by loading.tsx). */
export function DashboardSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="flex-1 flex min-h-screen" role="status" aria-label="Loading">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-surface">
        <div className="px-5 h-16 flex items-center gap-2 border-b border-border">
          <LogoMark size={26} />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="p-4 space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
        </div>
      </aside>
      <main className="flex-1 max-w-4xl px-4 sm:px-8 lg:px-12 py-10 space-y-6">
        <div className="space-y-2 mb-8">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className="rounded-[var(--radius-lg)] border border-border bg-surface p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-[var(--radius-md)]" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
          </div>
        ))}
        <span className="sr-only">Loading your dashboard…</span>
      </main>
    </div>
  );
}
