import { buildPageMetadata } from "@/lib/i18n/metadata";
import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getLocaleFromRequest } from "@/lib/i18n/server-locale";
import { siteUrl } from "@/lib/seo/site-url";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { WebPageSchema } from "@/components/seo/webpage-schema";
import { InteractionExplainer } from "@/components/herbs/interaction-explainer";
import { Button } from "@/components/ui/button";

export const generateMetadata = () =>
  buildPageMetadata({
    titleKey: "herbDrugInteractions",
    descKey: "herbDrugInteractionsDesc",
    path: "/herb-drug-interactions",
  });

const COMMON_HERBS = [
  { slug: "st-johns-wort", nameKey: "cStJohnsWort" },
  { slug: "garlic", nameKey: "cGarlic" },
  { slug: "turmeric", nameKey: "cTurmeric" },
  { slug: "ginger", nameKey: "cGinger" },
  { slug: "ginkgo", nameKey: "cGinkgo" },
  { slug: "kava", nameKey: "cKava" },
  { slug: "milk-thistle", nameKey: "cMilkThistle" },
  { slug: "ashwagandha", nameKey: "cAshwagandha" },
] as const;

export default async function HerbDrugInteractionsPage() {
  const locale = await getLocaleFromRequest();
  const t = await getTranslations({
    locale,
    namespace: "herbDrugInteractionsPage",
  });
  const tCommon = await getTranslations({ locale, namespace: "common" });
  const url = `${siteUrl()}/herb-drug-interactions`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <WebPageSchema
        title={t("heading")}
        description={t("intro")}
        url={url}
        breadcrumbs={[
          { name: "Home", url: siteUrl() },
          { name: t("heading"), url },
        ]}
      />

      <Breadcrumbs
        items={[
          { name: tCommon("breadcrumbHome"), href: "/" },
          { name: t("heading") },
        ]}
      />

      <header className="mt-4 space-y-3">
        <div className="flex items-center gap-2 text-amber-600">
          <AlertTriangle className="size-6" aria-hidden="true" />
          <span className="text-sm font-medium uppercase tracking-wide">
            {t("heading")}
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t("heading")}
        </h1>
        <p className="text-lg text-muted-foreground">{t("intro")}</p>
      </header>

      <div className="mt-8">
        <InteractionExplainer />
      </div>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold text-foreground">
          {t("commonHeading")}
        </h2>
        <div className="flex flex-wrap gap-2">
          {COMMON_HERBS.map((h) => (
            <Link
              key={h.slug}
              href={`/herbs/${h.slug}`}
              className="rounded-full border border-amber-200 bg-amber-50/60 px-3 py-1.5 text-sm font-medium text-amber-900 transition-colors hover:border-amber-400 hover:bg-amber-100 dark:border-amber-800/60 dark:bg-amber-950/20 dark:text-amber-200"
            >
              {t(h.nameKey)}
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10 rounded-2xl border bg-muted/30 p-6">
        <h2 className="text-xl font-semibold text-foreground">
          {t("ctaTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("ctaBody")}</p>
        <div className="mt-4">
          <Button render={<Link href="/herbalist" />}>
            {t("ctaButton")}
            <ArrowRight className="ml-1 size-4" />
          </Button>
        </div>
      </section>
    </div>
  );
}
