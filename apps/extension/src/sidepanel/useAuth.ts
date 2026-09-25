import { useCallback, useEffect, useRef, useState } from "react";
import {
  AUTH_STORAGE_KEY,
  getStoredAuth,
  getToken,
  signOut as signOutAndRevoke,
  startConnect,
  verifySession,
  type AuthUser,
} from "../lib/auth";

export type AuthState =
  | { status: "loading" }
  | { status: "signed-out"; reason?: "expired" }
  | { status: "signed-in"; user: AuthUser };

/**
 * Side-panel auth state, backed by chrome.storage (the background script
 * writes the token when the web app completes /extension-connect, and API
 * calls clear it on 401). On open, the token is confirmed with the server so
 * a session revoked elsewhere (password change, Account settings) shows up
 * as "reconnect" instead of failing later.
 */
export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const signingOutRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let hadAuth = false;

    getStoredAuth().then(async (auth) => {
      if (cancelled) return;
      if (!auth) {
        setState({ status: "signed-out" });
        return;
      }
      hadAuth = true;
      setState({ status: "signed-in", user: auth.user });
      const check = await verifySession();
      if (cancelled) return;
      if (check.status === "invalid") setState({ status: "signed-out", reason: "expired" });
      else if (check.status === "valid") setState({ status: "signed-in", user: check.user });
    });

    function onChanged(changes: Record<string, chrome.storage.StorageChange>, area: string) {
      if (area !== "local" || !(AUTH_STORAGE_KEY in changes)) return;
      getStoredAuth().then((auth) => {
        if (auth) {
          hadAuth = true;
          setState({ status: "signed-in", user: auth.user });
        } else {
          const expired = hadAuth && !signingOutRef.current;
          hadAuth = false;
          signingOutRef.current = false;
          setState(expired ? { status: "signed-out", reason: "expired" } : { status: "signed-out" });
        }
      });
    }
    chrome.storage.onChanged.addListener(onChanged);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  const signOut = useCallback(async () => {
    // Cleared by the storage listener once it has seen the removal.
    signingOutRef.current = true;
    await signOutAndRevoke();
    setState({ status: "signed-out" });
  }, []);

  return { state, getToken: useCallback(() => getToken(), []), connect: startConnect, signOut };
}
