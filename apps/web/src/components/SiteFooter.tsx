import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-black/[.06] dark:border-white/[.08] mt-auto">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-8 text-sm opacity-60">
        <Logo size={22} />
        <p>Built to save you from typing your resume into the same form for the hundredth time.</p>
      </div>
    </footer>
  );
}
