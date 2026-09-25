import Link from "next/link";
import { Logo } from "./Logo";
import { ButtonLink } from "./ui/button";
import { Show } from "./auth/Show";
import { UserMenu } from "./auth/UserMenu";

const NAV = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/65">
      <div className="max-w-6xl mx-auto flex h-16 items-center justify-between gap-4 px-5 sm:px-8">
        <Logo />
        <nav aria-label="Main" className="hidden md:flex items-center gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Show when="signed-out">
            <Link
              href="/sign-in"
              className="rounded-full px-3.5 py-2 text-sm font-medium text-muted hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <ButtonLink href="/sign-up" size="sm" className="h-9 px-4">
              Get started
            </ButtonLink>
          </Show>
          <Show when="signed-in">
            <ButtonLink href="/dashboard" variant="secondary" size="sm" className="h-9 px-4">
              Dashboard
            </ButtonLink>
            <UserMenu />
          </Show>
        </div>
      </div>
    </header>
  );
}
