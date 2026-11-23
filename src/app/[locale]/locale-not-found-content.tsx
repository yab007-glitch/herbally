"use client";

import { Leaf, ArrowLeft, Search, ShieldAlert, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Client-rendered 404 body so `src/app/[locale]/not-found.tsx` does not
 * serialize ~5 KB of 404 RSC JSX into every 200 OK page's flight payload.
 * Uses plain `<Link>` anchors (never `<Button render>`) so SSR HTML keeps
 * real crawlable `<a href>` links.
 */
export function LocaleNotFoundContent() {
  const t = useTranslations("notFound");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
        <Leaf className="h-8 w-8 text-green-600" aria-hidden />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">{t("title")}</h2>
        <p className="text-muted-foreground max-w-md">{t("message")}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
          {t("goHome")}
        </Link>
        <Link href="/herbs" className={cn(buttonVariants())}>
          <Search className="mr-2 h-4 w-4" aria-hidden />
          {t("browseHerbs")}
        </Link>
      </div>
      <nav
        aria-label={t("title")}
        className="text-muted-foreground flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm"
      >
        <Link
          href="/herb-drug-interactions"
          className="hover:text-foreground inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
        >
          <ShieldAlert className="h-4 w-4" aria-hidden />
          {t("checkInteractions")}
        </Link>
        <Link
          href="/symptoms"
          className="hover:text-foreground inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
        >
          {t("browseSymptoms")}
        </Link>
        <Link
          href="/herbalist"
          className="hover:text-foreground inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          {t("askHerbalist")}
        </Link>
      </nav>
    </div>
  );
}
