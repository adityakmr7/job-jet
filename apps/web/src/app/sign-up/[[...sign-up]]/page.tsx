import { SignUp } from "@clerk/nextjs";
import { AuthLayout } from "@/components/AuthLayout";

export default function Page() {
  return (
    <AuthLayout title="Spend less time on forms and more time on interviews.">
      <SignUp />
    </AuthLayout>
  );
}
