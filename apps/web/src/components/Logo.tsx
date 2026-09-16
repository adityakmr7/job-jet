import Link from "next/link";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold" style={{ fontSize: size * 0.6 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- small static
          SVG icon; next/image's optimizer disallows local SVGs by default */}
      <img src="/logo-mark.svg" alt="" width={size} height={size} className="rounded-lg" />
      <span>
        Job<span className="text-violet-600 dark:text-violet-400">Jet</span>
      </span>
    </Link>
  );
}
