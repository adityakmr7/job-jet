"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="flex-1 flex items-center justify-center px-6 py-24">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-5 w-12 h-12 rounded-2xl bg-danger-soft text-danger flex items-center justify-center">
          <TriangleAlert className="w-6 h-6" aria-hidden />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Something went wrong loading your dashboard</h1>
        <p className="mt-2 text-sm text-muted">It&apos;s probably temporary. Try again, and if it keeps happening, sign out and back in.</p>
        <Button className="mt-6" onClick={reset}>
          <RotateCcw className="w-4 h-4" aria-hidden /> Try again
        </Button>
      </div>
    </main>
  );
}
