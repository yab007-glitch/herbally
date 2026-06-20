"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { useTranslations } from "next-intl";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RouteErrorBoundaryProps {
  titleKey?: string;
  messageKey?: string;
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Shared error boundary for per-route error.tsx files.
 * Uses next-intl translations so French visitors see localized error messages.
 *
 * Defaults to the generic "Something went wrong" / "unexpectedError" messages.
 * Pass specific titleKey/messageKey for route-specific error text.
 */
export function RouteErrorBoundary({
  titleKey = "somethingWentWrong",
  messageKey = "unexpectedError",
  error,
  reset,
}: RouteErrorBoundaryProps) {
  const t = useTranslations("errors");

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">{t(titleKey)}</h2>
        <p className="text-muted-foreground max-w-md">{t(messageKey)}</p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => reset()}>
          <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
          {t("tryAgain")}
        </Button>
        <Link href="/">
          <Button>{t("goHome")}</Button>
        </Link>
      </div>
    </div>
  );
}