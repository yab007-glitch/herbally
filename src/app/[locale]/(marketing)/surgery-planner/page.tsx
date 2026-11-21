import type { Metadata } from "next";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { ArrowRight, CalendarClock, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getLocale } from "@/lib/i18n/page-locale";
import { buildPageMetadata } from "@/lib/i18n/metadata";
import { siteUrl } from "@/lib/seo/site-url";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { WebPageSchema } from "@/components/seo/webpage-schema";
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
    ? "Planificateur d'arrêt des plantes avant chirurgie"
    : "Pre-Surgery Herb & Supplement Washout Planner";
  const intro = fr
    ? "Indiquez la date de votre chirurgie et les plantes que vous prenez pour générer un calendrier imprimable à vérifier avec votre anesthésiste ou chirurgien."
    : "Enter your upcoming surgery date and current botanicals to build a printable washout checklist grounded in ASA and Health Canada guidance for your surgical team.";

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <WebPageSchema
        type="MedicalWebPage"
        title={heading}
        description={intro}
        url={url}
        breadcrumbs={[
          { name: tCommon("home"), url: baseUrl },
          { name: heading, url },
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
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
          <span>
            {fr
              ? "Révision éditoriale : Yasser Bheekun — MLT, OPTMQ · CSMLS"
              : "Editorially reviewed by Yasser Bheekun — MLT, OPTMQ · CSMLS"}
          </span>
        </p>
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
