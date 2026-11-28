import { getTranslations } from "next-intl/server";
import { getLocale } from "@/lib/i18n/page-locale";
import { ToolsMessagesProvider } from "@/components/i18n/tools-messages-provider";
import { buildPageMetadata } from "@/lib/i18n/metadata";
import { siteUrl } from "@/lib/seo/site-url";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { WebPageSchema } from "@/components/seo/webpage-schema";
import { WebApplicationSchema } from "@/components/seo/web-app-schema";
import { BreadcrumbListSchema } from "@/components/seo/breadcrumb-list-schema";
import { NpnCheckerClient } from "@/components/npn/npn-checker-client";
import { ClinicalSupportCallout } from "@/components/shared/clinical-support-callout";
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
  const fr = locale === "fr";
  const url = `${siteUrl()}${fr ? "/fr" : ""}/npn-checker`;

  return (
    <ToolsMessagesProvider locale={locale}>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <WebPageSchema
          type="MedicalWebPage"
          title={t("heading")}
          description={t("intro")}
          url={url}
        />
        <WebApplicationSchema
          name={t("heading")}
          description={t("intro")}
          url={url}
          featureList={[
            fr
              ? "Consultation en direct de la BDPSNH (LNHPD) de Santé Canada par NPN à 8 chiffres"
              : "Live Health Canada LNHPD lookup by 8-digit NPN / DIN-HM",
            fr
              ? "Distinction explicite entre statut de licence et statut de commercialisation"
              : "Explicit distinction between regulatory licence status and market status",
            fr
              ? "Dépistage automatique des ingrédients botaniques et interactions médicament-plante"
              : "Automatic medicinal ingredient matching and herb-drug interaction screening",
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
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Link
              href="/methodology"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 font-medium text-slate-800 hover:underline dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
            >
              <ShieldCheck
                className="size-3.5 text-slate-600 dark:text-slate-400"
                aria-hidden="true"
              />
              <span>
                {fr
                  ? "Compilation éditoriale : Yasser Bheekun — MLT, OPTMQ · CSMLS (non une validation clinique)"
                  : "Editorial compilation: Yasser Bheekun — MLT, OPTMQ · CSMLS (not clinical sign-off)"}
              </span>
            </Link>
          </div>
        </header>

        <div className="mt-6 rounded-xl border border-amber-300/70 bg-amber-50/70 p-4 text-xs leading-relaxed text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-semibold">
            {fr
              ? "Important : statut de licence Santé Canada vs statut de commercialisation"
              : "Important: Health Canada licence status vs. market status"}
          </p>
          <p className="mt-1">
            {fr
              ? "Le statut de licence (Active, Discontinuée, Suspension, Arrêt de vente ou Annulée) indique si Santé Canada a autorisé le produit en vertu du Règlement sur les produits de santé naturels. Le statut de commercialisation (Commercialisé vs Non commercialisé) est distinct : une licence active n'établit pas que le titulaire commercialise actuellement le produit en pharmacie. Vérifiez toujours le statut actuel sur la fiche officielle Santé Canada BDPSNH."
              : "Health Canada licence status (Active, Discontinued, Stop Sale, Suspended, or Cancelled) reflects regulatory product authorization under the Natural Health Products Regulations. Market status (Marketed vs. Not marketed) is separate: an active licence does not establish that the licence holder has reported the product as currently marketed on retail shelves. Always confirm current status on the linked official Health Canada LNHPD record."}
          </p>
        </div>

        <div className="mt-6">
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

        <ClinicalSupportCallout locale={locale} />
      </div>
    </ToolsMessagesProvider>
  );
}
