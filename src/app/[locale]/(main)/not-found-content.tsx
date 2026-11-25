"use client";

import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { AlertCircle, Home, ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { useTranslations } from "next-intl";

export default function NotFoundContent() {
  const t = useTranslations();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-muted">
        <AlertCircle className="size-10 text-muted-foreground" />
      </div>
      <h1 className="mb-2 text-4xl font-bold text-foreground">404</h1>
      <h2 className="mb-2 text-xl font-semibold text-foreground">
        {t("errors.404.title")}
      </h2>
      <p className="mb-8 max-w-md text-muted-foreground">
        {t("errors.404.message")}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/" className={buttonVariants()}>
          <Home className="mr-2 size-4" />
          {t("errors.404.home")}
        </Link>
        <Link href="/herbs" className={buttonVariants({ variant: "outline" })}>
          <ArrowLeft className="mr-2 size-4" />
          {t("herbs.browseAll")}
        </Link>
      </div>
    </div>
  );
}
