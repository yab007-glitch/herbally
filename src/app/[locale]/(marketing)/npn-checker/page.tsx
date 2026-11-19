import { getTranslations } from "next-intl/server";
import { getLocale } from "@/lib/i18n/page-locale";
import { buildPageMetadata } from "@/lib/i18n/metadata";
import { siteUrl } from "@/lib/seo/site-url";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { WebPageSchema } from "@/components/seo/webpage-schema";
import { BreadcrumbListSchema } from "@/components/seo/breadcrumb-list-schema";
import { NpnCheckerClient } from "@/components/npn/npn-checker-client";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { ShieldCheck } from "lucide-react";

export const generateMetadata = () =>
  buildPageMetadata({
    titleKey: "npnChecker",
    descKey: "npnCheckerDesc",
    path: "/npn-checker",
  });

export default async function NpnCheckerPage() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "npnCheckerPage" });
  const tCommon = await getTranslations({ locale, namespace: "common" });
  const url = `${siteUrl()}${locale === "fr" ? "/fr" : ""}/npn-checker`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <WebPageSchema
        title={t("heading")}
        description={t("intro")}
        url={url}
        breadcrumbs={[
          { name: tCommon("home"), url: siteUrl() },
          { name: t("heading"), url },
        ]}
      />
      <BreadcrumbListSchema
        items={[
          { name: "Home", url: "/" },
          { name: t("heading"), url: "/npn-checker" },
        ]}
      />

      <Breadcrumbs
        items={[
          { name: tCommon("breadcrumbHome"), href: "/" },
          { name: t("heading") },
        ]}
      />

      <header className="mt-4 space-y-3">
        <div className="flex items-center gap-2 text-primary">
          <ShieldCheck className="size-5" aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-wider">
            {t("eyebrow")}
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t("heading")}
        </h1>
        <p className="text-base text-muted-foreground sm:text-lg">
          {t("intro")}
        </p>
      </header>

      <div className="mt-8">
        <NpnCheckerClient />
      </div>

      <section className="mt-10 space-y-3 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-foreground">
          {t("explainerTitle")}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("explainerBody1")}
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("explainerBody2")}
        </p>
        <div className="flex flex-wrap gap-4 pt-2 text-sm">
          <Link
            href="/guides/how-to-read-health-canada-npn"
            className="font-medium text-primary hover:underline"
          >
            {t("readNpnGuideLink")} →
          </Link>
          <Link
            href="/herb-drug-interactions#stack-checker"
            className="font-medium text-primary hover:underline"
          >
            {t("openStackCheckerLink")} →
          </Link>
        </div>
      </section>
    </div>
  );
}
