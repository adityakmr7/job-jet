import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Logo } from "./Logo";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/75 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-6 py-4">
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
