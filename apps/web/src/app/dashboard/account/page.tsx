import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/session";
import { DashboardShell } from "@/components/DashboardShell";
import { AccountSettings } from "./AccountSettings";

export const metadata: Metadata = { title: "Account settings" };

export default async function AccountPage() {
  const user = await requirePageUser("/dashboard/account");
  return (
    <DashboardShell
      title="Account settings"
      description="Sign-in methods, password, connected devices and your data."
      email={user.email}
      name={user.name}
    >
      <AccountSettings email={user.email} name={user.name} emailVerified={user.emailVerified} />
    </DashboardShell>
  );
}
