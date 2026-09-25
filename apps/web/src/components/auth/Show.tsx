"use client";

import type { ReactNode } from "react";
import { useSession } from "@/lib/auth-client";

/**
 * Client-side signed-in / signed-out switch for otherwise static pages
 * (landing page, header). While the session is loading we render the
 * signed-out variant — most visitors are signed out, so this avoids a
 * layout jump for them. Purely cosmetic: nothing here is access control.
 */
export function Show({ when, children }: { when: "signed-in" | "signed-out"; children: ReactNode }) {
  const { data, isPending } = useSession();
  const signedIn = !isPending && Boolean(data?.user);
  if (when === "signed-in" ? signedIn : !signedIn) return <>{children}</>;
  return null;
}
