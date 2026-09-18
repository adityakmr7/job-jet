import { SignIn } from "@clerk/nextjs";
import { Logo } from "@/components/Logo";

export default function Page() {
  return (
    <div className="relative flex-1 flex flex-col items-center justify-center py-16 overflow-hidden">
      <div className="absolute inset-0 bg-grid pointer-events-none" aria-hidden />
      <div className="relative mb-8">
        <Logo size={32} />
      </div>
      <div className="relative">
        <SignIn />
      </div>
    </div>
  );
}
