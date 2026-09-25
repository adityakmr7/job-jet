"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutDashboard, LogOut, Settings } from "lucide-react";
import { signOut, useSession } from "@/lib/auth-client";

function initials(name: string | undefined, email: string | undefined): string {
  const source = (name && name.trim()) || email || "?";
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * Avatar button + menu (dashboard, account settings, sign out).
 * `placement="up"` opens the menu above the avatar (dashboard sidebar footer).
 */
export function UserMenu({
  email: emailProp,
  name: nameProp,
  placement = "down",
}: {
  email?: string;
  name?: string;
  placement?: "down" | "up";
}) {
  const { data } = useSession();
  const email = data?.user.email ?? emailProp;
  const name = data?.user.name ?? nameProp;
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut().catch(() => {});
    router.push("/");
    router.refresh();
  }

  if (!email) return null;

  const itemClass =
    "flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-sm text-foreground hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent";

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Account menu for ${email}`}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-[13px] font-semibold text-accent-foreground shadow-[var(--shadow-card)] hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {initials(name, email)}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className={`absolute z-40 w-60 ${placement === "up" ? "bottom-full left-0 mb-2" : "right-0 mt-2"} rounded-[var(--radius-lg)] border border-border bg-surface p-1.5 shadow-[var(--shadow-popover)]`}
        >
          <div className="px-3 py-2 border-b border-border mb-1">
            {name && <p className="text-sm font-semibold truncate">{name}</p>}
            <p className="text-xs text-muted truncate">{email}</p>
          </div>
          <Link role="menuitem" href="/dashboard" className={itemClass} onClick={() => setOpen(false)}>
            <LayoutDashboard className="w-4 h-4 text-muted" aria-hidden /> Dashboard
          </Link>
          <Link role="menuitem" href="/dashboard/account" className={itemClass} onClick={() => setOpen(false)}>
            <Settings className="w-4 h-4 text-muted" aria-hidden /> Account settings
          </Link>
          <button role="menuitem" type="button" className={itemClass} onClick={handleSignOut} disabled={signingOut}>
            <LogOut className="w-4 h-4 text-muted" aria-hidden /> {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
