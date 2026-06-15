"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
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
        <AlertCircle className="size-10 text-destructive" />
      </div>
      <h1 className="mb-2 text-2xl font-bold text-foreground">
        Something went wrong
      </h1>
      <p className="mb-6 max-w-md text-muted-foreground">
        We encountered an unexpected error. Don&apos;t worry — your data is
        safe.
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
      {process.env.NODE_ENV === "development" && (
        <div className="mt-8 max-w-2xl overflow-auto rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-left text-sm">
          <p className="font-mono text-destructive">{error.message}</p>
          {error.stack && (
            <pre className="mt-2 text-xs text-muted-foreground">
              {error.stack}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
