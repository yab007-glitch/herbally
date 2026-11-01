import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { getLocale } from "@/lib/i18n/page-locale";
import { buildPageMetadata } from "@/lib/i18n/metadata";
import { HomeSearchClient } from "./home-search-client";
import { HeroVisual } from "./hero-visual";
import { WelcomeToast } from "@/components/auth/welcome-toast";
import { BookOpen, Calculator, ShieldAlert, MessageCircle } from "lucide-react";
import Link from "next/link";

// M10 (audit 2026-06-22): the homepage previously had no generateMetadata, so
// it emitted no canonical URL or hreflang alternates — the highest-traffic
// page lacked the locale signals Google uses for en/fr routing. buildPageMetadata
// derives canonical + en/fr/x-default alternates from the path "/".
export const generateMetadata = () =>
  buildPageMetadata({ titleKey: "homeTitle", path: "/" });

const FEATURES = [
  {
    href: "/herbs",
    icon: BookOpen,
    titleKey: "home.featureHerbsTitle",
    descKey: "home.featureHerbsDescription",
  },
  {
    href: "/herb-drug-interactions",
    icon: ShieldAlert,
    titleKey: "home.featureInteractionsTitle",
    descKey: "home.featureInteractionsDescription",
  },
  {
    href: "/calculator",
    icon: Calculator,
    titleKey: "home.featureCalculatorTitle",
    descKey: "home.featureCalculatorDescription",
  },
  {
    href: "/herbalist",
    icon: MessageCircle,
    titleKey: "home.featureAiTitle",
    descKey: "home.featureAiDescription",
  },
] as const;

const POPULAR_HERBS = [
  { slug: "turmeric", nameKey: "herbDrugInteractionsPage.cTurmeric" },
  { slug: "garlic", nameKey: "herbDrugInteractionsPage.cGarlic" },
  { slug: "ginger", nameKey: "herbDrugInteractionsPage.cGinger" },
  { slug: "ginkgo-biloba", nameKey: "herbDrugInteractionsPage.cGinkgo" },
  { slug: "st-johns-wort", nameKey: "herbDrugInteractionsPage.cStJohnsWort" },
  { slug: "kava", nameKey: "herbDrugInteractionsPage.cKava" },
  { slug: "milk-thistle", nameKey: "herbDrugInteractionsPage.cMilkThistle" },
  { slug: "ashwagandha", nameKey: "herbDrugInteractionsPage.cAshwagandha" },
] as const;

export default async function HomePage() {
  const locale = await getLocale();
  const t = await getTranslations({ locale });

  return (
    <>
      <Suspense fallback={null}>
        <WelcomeToast />
      </Suspense>
      <div className="mx-auto grid w-full max-w-5xl gap-10 px-4 pt-12 pb-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-16 lg:pt-20">
        <div className="text-center lg:pt-6 lg:text-left">
          {/* Server-rendered hero — this is the LCP element.
              No logo mark here: the header already carries it, and a second
              leaf on the same screen pushed the form below the fold on a
              phone. */}
          <p className="eyebrow mb-3">{t("home.eyebrow")}</p>
          <h1 className="text-balance text-4xl font-medium tracking-tight text-foreground sm:text-5xl lg:text-[3.4rem] lg:leading-[1.04]">
            {t("home.heroTitle")}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base lg:mx-0">
            {t("home.heroSubtitle")}
          </p>
          <div className="rule mt-6 hidden max-w-xs lg:block" />
        </div>

        <div className="w-full">
          <HomeSearchClient
            labels={{
              herbLabel: t("home.herbLabel"),
              medLabel: t("home.medLabel"),
              herbPlaceholder: t("home.herbPlaceholder"),
              medPlaceholder: t("home.medPlaceholder"),
              checkButton: t("home.checkButton"),
              suggestionsTitle: t("home.suggestionsTitle"),
              suggestion1: t("home.suggestion1"),
              suggestion2: t("home.suggestion2"),
              suggestion3: t("home.suggestion3"),
              suggestion4: t("home.suggestion4"),
              trustLine: t("home.trustLine"),
              symptomsLink: t("home.symptomsLink"),
              emptyCheckError: t("home.emptyCheckError"),
              sameCheckError: t("home.sameCheckError"),
              checking: t("home.checkerChecking"),
              checkerFoundTitle: t("home.checkerFoundTitle"),
              checkerAskHerbalist: t("home.checkerAskHerbalist"),
              checkerViewPair: t("home.checkerViewPair"),
              checkerViewHerb: t("home.checkerViewHerb"),
              checkerDisclaimer: t("home.checkerDisclaimer"),
              checkerNotFoundTitle: t("home.checkerNotFoundTitle"),
              // Raw: the client substitutes {herb}/{drug} itself, and passing the
              // message through ICU formatting here throws FORMATTING_ERROR for
              // the variables it never receives.
              checkerNotFoundBody: t.raw("home.checkerNotFoundBody"),
              checkerAiNote: t("home.checkerAiNote"),
              checkerError: t("home.checkerError"),
              checkerSource: t("home.checkerSource"),
              checkerEvidence: t("home.checkerEvidence"),
              checkerMechanism: t("home.checkerMechanism"),
              severityMild: t("interactions.severity.mild"),
              severityModerate: t("interactions.severity.moderate"),
              severitySevere: t("interactions.severity.severe"),
              severityContraindicated: t(
                "interactions.severity.contraindicated"
              ),
            }}
          />

          {/* Browse all herbs link */}
          <div className="mt-4">
            <Link
              href="/herbs"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("home.heroButton")} →
            </Link>
          </div>
        </div>
      </div>

      <HeroVisual />

      {/* Phase 2 explainer — previously the page ended at the checker,
          leaving a first-time visitor with no picture of the library. */}
      <section className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <h2 className="text-center text-2xl font-bold tracking-tight text-foreground">
          {t("home.explainerTitle")}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-muted-foreground sm:text-base">
          {t("home.explainerBody")}
        </p>

        <h3 className="mt-10 text-center text-lg font-semibold text-foreground">
          {t("home.featuresTitle")}
        </h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              className="rounded-2xl border bg-card p-4 text-left transition-colors hover:border-primary/40"
            >
              <f.icon className="size-5 text-primary" aria-hidden="true" />
              <p className="mt-2 font-semibold text-foreground">
                {t(f.titleKey)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(f.descKey)}
              </p>
            </Link>
          ))}
        </div>

        <h3 className="mt-10 text-center text-lg font-semibold text-foreground">
          {t("home.popularTitle")}
        </h3>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {POPULAR_HERBS.map((h) => (
            <Link
              key={h.slug}
              href={`/herbs/${h.slug}`}
              className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors"
            >
              {t(h.nameKey)}
            </Link>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed text-muted-foreground">
          {t("home.explainerNote")}
        </p>
      </section>
    </>
  );
}
