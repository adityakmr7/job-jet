"use client";

import Link from "next/link";
import { useId } from "react";

/** The Job Jet mark: a "J" that takes off as an arrow, with a contrail. */
export function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  // Unique per instance: a gradient referenced from an element whose
  // defining <svg> is display:none (e.g. the hidden desktop sidebar on
  // mobile) doesn't paint, so ids can't be shared between logos.
  const gradientId = `jj-mark-${useId().replace(/:/g, "")}`;
  return (
    <svg
      viewBox="0 0 128 128"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="16" y1="8" x2="112" y2="124" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4557f0" />
          <stop offset="1" stopColor="#1c2699" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="120" height="120" rx="30" fill={`url(#${gradientId})`} />
      <path d="M34 60 H56" stroke="#f2622e" strokeWidth="9" strokeLinecap="round" />
      <path d="M26 78 H52" stroke="#f2622e" strokeWidth="9" strokeLinecap="round" opacity="0.6" />
      <path
        d="M80 34 V80 C80 94 71 102 58 102 C49 102 43 98 40 92"
        stroke="#fff"
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M63 46 L80 28 L97 46" stroke="#fff" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ size = 28, inverted = false }: { size?: number; inverted?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight" style={{ fontSize: size * 0.62 }}>
      <LogoMark size={size} />
      <span>
        Job<span className={inverted ? "text-[#9eacff]" : "text-accent"}>Jet</span>
      </span>
    </span>
  );
}

export function Logo({ size = 28, href = "/", inverted = false }: { size?: number; href?: string; inverted?: boolean }) {
  return (
    <Link href={href} aria-label="Job Jet home" className="inline-flex rounded-lg">
      <Wordmark size={size} inverted={inverted} />
    </Link>
  );
}
