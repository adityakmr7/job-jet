import type { Metadata } from "next";
import { AuthLayout } from "@/components/AuthLayout";
import { AuthCard } from "@/components/auth/AuthCard";
import { requirePageUser } from "@/lib/auth/session";
import { isAllowedExtensionId } from "@/lib/auth/origins";
import { isValidConnectState } from "@/lib/auth/extension-connect";
import { ExtensionConnect } from "./ExtensionConnect";

export const metadata: Metadata = { title: "Connect the extension", referrer: "no-referrer" };

/**
 * Opened by the extension's side panel ("Connect to Job Jet") as
 * /extension-connect?ext=<extension id>&state=<nonce>. After an explicit
 * click, it mints an extension session and hands the token to that
 * extension ID only (chrome.runtime.sendMessage; the extension's
 * externally_connectable limits which origins can reach it).
 */
export default async function ExtensionConnectPage({ searchParams }: PageProps<"/extension-connect">) {
  const params = await searchParams;
  const ext = typeof params.ext === "string" ? params.ext : "";
  const state = typeof params.state === "string" ? params.state : "";
  const qs = new URLSearchParams({ ext, state }).toString();
  const user = await requirePageUser(`/extension-connect?${qs}`);

  const valid = isAllowedExtensionId(ext) && isValidConnectState(state);

  return (
    <AuthLayout title="Bring your profile to every application form.">
      {valid ? (
        <ExtensionConnect extensionId={ext} state={state} email={user.email} />
      ) : (
        <AuthCard
          title="This connect link isn't valid"
          description="Open the Job Jet side panel in Chrome and click “Connect to Job Jet” again. If you installed the extension from somewhere other than the Chrome Web Store, it can't connect to this site."
        >
          <p className="text-sm text-muted">No data was shared.</p>
        </AuthCard>
      )}
    </AuthLayout>
  );
}
