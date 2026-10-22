"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="size-10 text-destructive" aria-hidden />
      </div>
      <h1 className="mb-2 text-2xl font-bold text-foreground">
        {t("500.title")}
      </h1>
      <p className="mb-2 max-w-md text-muted-foreground">{t("500.message")}</p>
      <p className="mb-6 max-w-md text-muted-foreground">{t("500.dataSafe")}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={reset} className="gap-2">
          <RefreshCw className="size-4" aria-hidden />
          {t("500.retry")}
        </Button>
        <Button variant="outline" render={<Link href="/" />}>
          <Home className="mr-2 size-4" aria-hidden />
          {t("goHome")}
        </Button>
      </div>
    </div>
  );
}
