import { useEffect, useRef, useState } from "react";
import type { AuthUser } from "../lib/auth";

function initials(user: AuthUser): string {
  const source = user.name.trim() || user.email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Avatar button → email, dashboard link, sign out (revokes the session). */
export function AccountMenu({
  user,
  dashboardUrl,
  onSignOut,
}: {
  user: AuthUser;
  dashboardUrl: string;
  onSignOut: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="account" ref={rootRef}>
      <button
        type="button"
        className="avatar"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${user.email}`}
        onClick={() => setOpen((v) => !v)}
      >
        {initials(user)}
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-head">
            {user.name && <strong>{user.name}</strong>}
            <span>{user.email}</span>
          </div>
          <a role="menuitem" className="menu-item" href={dashboardUrl} target="_blank" rel="noopener noreferrer">
            Open dashboard
          </a>
          <button
            role="menuitem"
            type="button"
            className="menu-item"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onSignOut();
              setBusy(false);
              setOpen(false);
            }}
          >
            {busy ? "Signing out…" : "Sign out of extension"}
          </button>
        </div>
      )}
    </div>
  );
}
