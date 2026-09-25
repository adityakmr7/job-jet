import { SignIn } from "@clerk/nextjs";
import { AuthLayout } from "@/components/AuthLayout";

export default function Page() {
  return (
    <AuthLayout title="Welcome back. Let's get you through some applications.">
      <SignIn />
    </AuthLayout>
  );
}
