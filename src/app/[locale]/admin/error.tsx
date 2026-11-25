"use client";

import { useEffect } from "react";
import { captureClientException } from "@/lib/sentry/client-deferred";
import { AlertTriangle, RotateCcw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import Link from "next/link";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void captureClientException(error);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-7 w-7 text-destructive" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Admin error</h2>
        <p className="text-muted-foreground max-w-md">
          Something went wrong in the admin panel.
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => reset()}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Try again
        </Button>
        <Link href="/admin" className={buttonVariants({ variant: "outline" })}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Admin home
        </Link>
      </div>
    </div>
  );
}
