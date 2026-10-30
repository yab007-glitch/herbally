import { getTranslations } from "next-intl/server";
import { getLocale } from "@/lib/i18n/page-locale";
import { buildPageMetadata } from "@/lib/i18n/metadata";
import { HomeSearchClient } from "./home-search-client";
import { HeroVideo } from "./hero-video";
import { WelcomeToast } from "@/components/auth/welcome-toast";
import {
  Leaf,
  BookOpen,
  Calculator,
  ShieldAlert,
  MessageCircle,
} from "lucide-react";
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
  { slug: "ginkgo", nameKey: "herbDrugInteractionsPage.cGinkgo" },
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
      <WelcomeToast />
      <div className="flex flex-col items-center px-4 pt-10 pb-4">
        <div className="w-full max-w-lg text-center">
          {/* Logo mark */}
          <div className="mx-auto mb-6 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Leaf className="size-6" />
          </div>

          {/* Server-rendered hero — this is the LCP element */}
          <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t("home.heroTitle")}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-pretty text-sm text-muted-foreground sm:text-base">
            {t("home.heroSubtitle")}
          </p>

          <HomeSearchClient
            labels={{
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
              checkerNotFoundBody: t("home.checkerNotFoundBody"),
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

      <HeroVideo />

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
