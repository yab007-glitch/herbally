import type { Metadata } from "next";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { ArrowRight, CalendarClock, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getLocale } from "@/lib/i18n/page-locale";
import { buildPageMetadata } from "@/lib/i18n/metadata";
import { siteUrl } from "@/lib/seo/site-url";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { WebPageSchema } from "@/components/seo/webpage-schema";
import { WebApplicationSchema } from "@/components/seo/web-app-schema";
import { BreadcrumbListSchema } from "@/components/seo/breadcrumb-list-schema";
import { SurgeryPlannerClient } from "@/components/interactions/surgery-planner-client";
import { ClinicalSupportCallout } from "@/components/shared/clinical-support-callout";

export const revalidate = 86400;

export const generateMetadata = (): Promise<Metadata> =>
  buildPageMetadata({
    titleKey: "surgeryPlanner",
    descKey: "surgeryPlannerDesc",
    path: "/surgery-planner",
  });

export default async function SurgeryPlannerPage() {
  const locale = await getLocale();
  const fr = locale === "fr";
  const tCommon = await getTranslations({ locale, namespace: "common" });

  const baseUrl = siteUrl();
  const url = `${baseUrl}${fr ? "/fr" : ""}/surgery-planner`;
  const heading = fr
    ? "Liste préopératoire des plantes et suppléments"
    : "Pre-Surgery Supplement Review Checklist";
  const intro = fr
    ? "Indiquez la date de votre chirurgie et les plantes que vous prenez pour préparer une liste imprimable à vérifier avec votre anesthésiste ou chirurgien."
    : "Enter your upcoming surgery date and current botanicals to prepare a printable supplement checklist for review with your surgical and anesthesia team.";

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <WebPageSchema
        type="MedicalWebPage"
        title={heading}
        description={intro}
        url={url}
      />
      <WebApplicationSchema
        name={heading}
        description={intro}
        url={url}
        featureList={[
          fr
            ? "Liste de vérification imprimable avant chirurgie et anesthésie"
            : "Printable pre-operative supplement checklist for surgical & anesthesia teams",
          fr
            ? "Références primaires ASA et NIH NCCIH (aucun ordre générique d'arrêt automatique)"
            : "ASA and NIH NCCIH citations without blanket self-discontinuation directives",
          fr
            ? "Traitement 100 % côté client sans publicité ni témoin publicitaire"
            : "100% client-side checklist with zero advertising or ad tracking cookies",
        ]}
      />
      <BreadcrumbListSchema
        items={[
          { name: "Home", url: "/" },
          { name: heading, url: "/surgery-planner" },
        ]}
      />

      <Breadcrumbs
        items={[
          { name: tCommon("breadcrumbHome"), href: "/" },
          { name: heading },
        ]}
      />

      <header className="mt-4 space-y-3">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <CalendarClock className="size-4" aria-hidden="true" />
          <span>{fr ? "Sécurité préopératoire" : "Pre-Operative Safety"}</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {heading}
        </h1>
        <p className="text-base text-muted-foreground sm:text-lg">{intro}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
            <ShieldCheck
              className="size-3.5 text-slate-600 dark:text-slate-400"
              aria-hidden="true"
            />
            <span>
              {fr
                ? "Compilation éditoriale : Yasser Bheekun — MLT, OPTMQ · CSMLS (non une validation clinique)"
                : "Editorial compilation: Yasser Bheekun — MLT, OPTMQ · CSMLS (not clinical sign-off)"}
            </span>
          </span>
        </div>
      </header>

      <div className="mt-8">
        <SurgeryPlannerClient />
      </div>

      <section className="no-print mt-10 flex flex-wrap gap-4 rounded-2xl border border-border bg-muted/30 p-5 text-sm">
        <Link
          href="/guides/herbs-to-stop-before-surgery"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          <span>
            {fr
              ? "Lire le guide complet sur la chirurgie"
              : "Read the full pre-surgery guide"}
          </span>
          <ArrowRight className="size-4" />
        </Link>
        <Link
          href="/medications"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          <span>
            {fr
              ? "Vérifier par médicament d'ordonnance"
              : "Browse Medication Interactions A–Z"}
          </span>
          <ArrowRight className="size-4" />
        </Link>
      </section>

      <ClinicalSupportCallout locale={locale} />
    </div>
  );
}
