import Link from "next/link";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-8 text-sm text-muted">
        <Logo size={22} />
        <p>Built to save you from typing your resume into the same form for the hundredth time.</p>
        <nav className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
