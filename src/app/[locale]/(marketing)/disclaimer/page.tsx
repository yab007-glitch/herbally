import { buildPageMetadata } from "@/lib/i18n/metadata";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { WebPageSchema } from "@/components/seo/webpage-schema";
import { BreadcrumbListSchema } from "@/components/seo/breadcrumb-list-schema";
import { siteUrl } from "@/lib/seo/site-url";
import { AlertTriangle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getLocale } from "@/lib/i18n/page-locale";

export const generateMetadata = () =>
  buildPageMetadata({
    titleKey: "medicalDisclaimer",
    descKey: "medicalDisclaimerDesc",
    path: "/disclaimer",
  });

export default async function DisclaimerPage() {
  const locale = await getLocale();
  const t = await getTranslations({ locale });
  const prefix = locale === "fr" ? "/fr" : "";
  const url = `${siteUrl()}${prefix}/disclaimer`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <WebPageSchema
        title={t("disclaimer.title")}
        description={t("meta.medicalDisclaimerDesc")}
        url={url}
        breadcrumbs={[
          { name: t("common.home"), url: siteUrl() },
          { name: t("disclaimer.title"), url },
        ]}
      />
      <BreadcrumbListSchema
        items={[
          { name: "Home", url: "/" },
          { name: t("disclaimer.title"), url: "/disclaimer" },
        ]}
      />
      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex size-14 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          <AlertTriangle className="size-7" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {t("disclaimer.title")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("disclaimer.text")}</p>
      </div>

      <div className="prose prose-sm max-w-none dark:prose-invert">
        <p className="text-muted-foreground leading-relaxed">
          {t("disclaimer.consult")}
        </p>
        <p className="text-muted-foreground leading-relaxed">
          {t("disclaimer.fda")}
        </p>
        <p className="text-muted-foreground leading-relaxed">
          {t("disclaimer.canada")}
        </p>
        <p className="text-muted-foreground leading-relaxed">
          {t("disclaimer.emergency")}
        </p>
        <p className="text-muted-foreground leading-relaxed">
          {t("disclaimer.reliance")}
        </p>
      </div>

      <div className="mt-10 flex flex-wrap gap-4 border-t border-border pt-6 text-sm">
        <Link href="/editorial-policy" className="text-primary hover:underline">
          {t("footer.editorialPolicy")} →
        </Link>
        <Link href="/npn-checker" className="text-primary hover:underline">
          {t("footer.npnChecker")} →
        </Link>
        <Link href="/contact" className="text-primary hover:underline">
          {t("footer.contact")} →
        </Link>
      </div>
    </div>
  );
}
