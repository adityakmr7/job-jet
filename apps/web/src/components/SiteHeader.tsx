import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Logo } from "./Logo";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-black/[.06] dark:border-white/[.08] bg-background/80 backdrop-blur">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-6 py-4">
        <Logo />
        <nav className="flex items-center gap-3">
          <Show when="signed-out">
            <Link href="/sign-in" className="text-sm font-medium opacity-80 hover:opacity-100">
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-full bg-violet-700 text-white px-4 py-2 text-sm font-semibold hover:bg-violet-800 transition-colors"
            >
              Get started free
            </Link>
          </Show>
          <Show when="signed-in">
            <Link href="/dashboard" className="text-sm font-medium opacity-80 hover:opacity-100">
              Dashboard
            </Link>
            <UserButton />
          </Show>
        </nav>
      </div>
    </header>
  );
}
