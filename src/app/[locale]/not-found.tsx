import type { Metadata } from "next";
import { Leaf, ArrowLeft, Search, ShieldAlert, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { getTranslations } from "next-intl/server";
import { getLocale } from "@/lib/i18n/page-locale";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "notFound" });
  return {
    // `absolute` bypasses the root layout's `%s | HerbAlly` title template —
    // without it the tab reads "Page Not Found | HerbAlly | HerbAlly".
    title: { absolute: `${t("title")} | HerbAlly` },
    // follow, not "no": a 404 is never indexed either way, and its outbound
    // links are the only thing a lost visitor or a crawler can act on.
    robots: { index: false, follow: true },
  };
}

export default async function NotFound() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "notFound" });

  // Plain anchors styled with the button recipe, not <Button render={<Link/>}>:
  // Base UI's `render` prop shipped a <button> with no <a href> in the server
  // HTML, so "Go home" and "Browse herbs" only became links after hydration —
  // the live 404 had zero crawlable links in its markup. The recipe lives in a
  // module without "use client" so a server component can call it.
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
