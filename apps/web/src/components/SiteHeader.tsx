import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Logo } from "./Logo";

export function SiteHeader() {
  return (
    <header className="sticky top-4 z-10 px-4">
      <div className="max-w-3xl mx-auto flex items-center justify-between gap-4 rounded-full border border-border bg-surface/90 backdrop-blur-md supports-[backdrop-filter]:bg-surface/70 px-5 py-2.5 shadow-[var(--shadow-card)]">
        <Logo />
        <nav className="flex items-center gap-4">
          <Show when="signed-out">
            <Link href="/sign-in" className="text-sm font-medium text-muted hover:text-foreground transition-colors">
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-full bg-accent text-accent-foreground px-4 py-2 text-sm font-semibold shadow-[var(--shadow-card)] hover:bg-accent-hover hover:shadow-[var(--shadow-card-hover)] transition-all"
            >
              Get started free
            </Link>
          </Show>
          <Show when="signed-in">
            <Link href="/dashboard" className="text-sm font-medium text-muted hover:text-foreground transition-colors">
              Dashboard
            </Link>
            <UserButton />
          </Show>
        </nav>
      </div>
    </header>
  );
}
