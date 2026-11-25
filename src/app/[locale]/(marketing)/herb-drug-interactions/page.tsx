import { buildPageMetadata } from "@/lib/i18n/metadata";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getLocale } from "@/lib/i18n/page-locale";
import { ToolsMessagesProvider } from "@/components/i18n/tools-messages-provider";
import { siteUrl } from "@/lib/seo/site-url";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { WebPageSchema } from "@/components/seo/webpage-schema";
import { BreadcrumbListSchema } from "@/components/seo/breadcrumb-list-schema";
import { InteractionExplainer } from "@/components/herbs/interaction-explainer";
import { EmbedSnippet } from "@/components/embed/embed-snippet";
import { StackChecker } from "@/components/interactions/stack-checker";
import { ClinicalSupportCallout } from "@/components/shared/clinical-support-callout";
import { buttonVariants } from "@/components/ui/button-variants";
import { InteractionChecker } from "../interaction-checker";

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
  { slug: "ginkgo-biloba", nameKey: "cGinkgo" },
  { slug: "kava", nameKey: "cKava" },
  { slug: "milk-thistle", nameKey: "cMilkThistle" },
  { slug: "ashwagandha", nameKey: "cAshwagandha" },
] as const;

export default async function HerbDrugInteractionsPage() {
  const locale = await getLocale();
  const t = await getTranslations({
    locale,
    namespace: "herbDrugInteractionsPage",
  });
  const tCommon = await getTranslations({ locale, namespace: "common" });
  const fr = locale === "fr";
  const url = `${siteUrl()}${fr ? "/fr" : ""}/herb-drug-interactions`;

  return (
    <ToolsMessagesProvider locale={locale}>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <WebPageSchema
          type="MedicalWebPage"
          title={t("heading")}
          description={t("intro")}
          url={url}
        />
        <BreadcrumbListSchema
          items={[
            { name: "Home", url: "/" },
            { name: t("heading"), url: "/herb-drug-interactions" },
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
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertTriangle
              className="size-3.5 text-amber-600"
              aria-hidden="true"
            />
            <Link
              href="/methodology"
              className="hover:text-foreground hover:underline"
            >
              {fr
                ? "Référence éducative issue de monographies publiques — fiches héritées non révisées par un clinicien"
                : "Educational reference compiled from public monographs — legacy interaction rows lack clinician sign-off"}
            </Link>
          </p>
        </header>

        {/* The checker itself, on the page.
          This used to be a card explaining that the checker lives on the
          homepage, with a button that sent the visitor there — on the one page
          whose subject is checking a combination. */}
        <section className="mt-8">
          <h2 className="mb-3 text-xl font-semibold text-foreground">
            {t("checkerCtaTitle")}
          </h2>
          <InteractionChecker showBrowseLink={false} />
        </section>

        <div className="mt-8">
          <StackChecker />
        </div>

        <section className="mt-8 flex flex-col justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {t("npnBannerTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("npnBannerBody")}
            </p>
          </div>
          <Link
            href="/npn-checker"
            className={buttonVariants({ className: "shrink-0" })}
          >
            {t("npnBannerButton")}
            <ArrowRight className="ml-1 size-4" />
          </Link>
        </section>

        <section className="mt-4 flex flex-col justify-between gap-3 rounded-2xl border bg-muted/30 p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {t("medicationsBannerTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("medicationsBannerBody")}
            </p>
          </div>
          <Link
            href="/medications"
            className={buttonVariants({
              variant: "outline",
              className: "shrink-0",
            })}
          >
            {t("medicationsBannerButton")}
            <ArrowRight className="ml-1 size-4" />
          </Link>
        </section>

        <section className="mt-4 flex flex-col justify-between gap-3 rounded-2xl border bg-muted/30 p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {t("surgeryBannerTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("surgeryBannerBody")}
            </p>
          </div>
          <Link
            href="/surgery-planner"
            className={buttonVariants({
              variant: "outline",
              className: "shrink-0",
            })}
          >
            {t("surgeryBannerButton")}
            <ArrowRight className="ml-1 size-4" />
          </Link>
        </section>

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
            {t("embedTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("embedBody")}</p>
          <EmbedSnippet />
          <p className="mt-3 text-xs">
            <Link
              href="/widgets"
              className="font-medium text-primary hover:underline"
            >
              {t("widgetsHubLink")} →
            </Link>
          </p>
        </section>

        <section className="mt-10 rounded-2xl border bg-muted/30 p-6">
          <h2 className="text-xl font-semibold text-foreground">
            {t("ctaTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("ctaBody")}</p>
          <div className="mt-4">
            <Link href="/herbalist" className={buttonVariants()}>
              {t("ctaButton")}
              <ArrowRight className="ml-1 size-4" />
            </Link>
          </div>
        </section>

        <ClinicalSupportCallout locale={locale} />
      </div>
    </ToolsMessagesProvider>
  );
}
