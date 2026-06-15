"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { ArrowLeftRight, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CompareError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-destructive/10">
        <ArrowLeftRight className="size-10 text-destructive" />
      </div>
      <h1 className="mb-2 text-2xl font-bold text-foreground">
        Comparison error
      </h1>
      <p className="mb-6 max-w-md text-muted-foreground">
        We couldn&apos;t load the herb comparison. Please try again.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={reset} className="gap-2">
          <RefreshCw className="size-4" />
          Try Again
        </Button>
        <Button variant="outline" render={<Link href="/" />}>
          <Home className="mr-2 size-4" />
          Go Home
        </Button>
      </div>
    </div>
  );
}
