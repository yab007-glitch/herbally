import type { Metadata } from "next";
import { Leaf, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getLocaleFromRequest } from "@/lib/i18n/server-locale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocaleFromRequest();
  const t = await getTranslations({ locale, namespace: "notFound" });
  return {
    // `absolute` bypasses the root layout's `%s | HerbAlly` title template —
    // without it the tab reads "Page Not Found | HerbAlly | HerbAlly".
    title: { absolute: `${t("title")} | HerbAlly` },
    robots: { index: false, follow: false },
  };
}

export default async function NotFound() {
  const locale = await getLocaleFromRequest();
  const t = await getTranslations({ locale, namespace: "notFound" });

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
        <Leaf className="h-8 w-8 text-green-600" aria-hidden />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">{t("title")}</h2>
        <p className="text-muted-foreground max-w-md">{t("message")}</p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" render={<Link href="/" />}>
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
          {t("goHome")}
        </Button>
        <Button render={<Link href="/herbs" />}>{t("browseHerbs")}</Button>
      </div>
    </div>
  );
}
