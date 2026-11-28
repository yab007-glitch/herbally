import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { getLocale } from "@/lib/i18n/page-locale";
import { buildPageMetadata } from "@/lib/i18n/metadata";
import { InteractionChecker } from "./interaction-checker";
import { HeroVisual } from "./hero-visual";
import { HowItWorks } from "./how-it-works";
import { WelcomeToast } from "@/components/auth/welcome-toast";
import { BookOpen, Calculator, ShieldAlert, MessageCircle } from "lucide-react";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";

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
      <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 pt-6 pb-4 sm:gap-10 sm:pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-16 lg:pt-20">
        <div className="text-center lg:text-left">
          {/* Server-rendered hero — this is the LCP element.
              No logo mark here: the header already carries it, and a second
              leaf on the same screen pushed the form below the fold on a
              phone. */}
          <p className="eyebrow mb-3 hidden sm:block">{t("home.eyebrow")}</p>
          <h1 className="text-balance text-4xl font-medium tracking-tight text-foreground sm:text-5xl lg:text-[3.4rem] lg:leading-[1.04]">
            {t("home.heroTitle")}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base lg:mx-0">
            {t("home.heroSubtitle")}
          </p>
          <p className="mt-3 text-xs font-medium text-muted-foreground">
            {locale === "fr"
              ? "Référence éducative · Pas une validation clinique · Aucun compte requis · EN & FR"
              : "Educational screening reference · Not clinical clearance · No account required · EN & FR"}
          </p>
          <div className="rule mt-5 hidden max-w-xs lg:block" />
          {/* Task-oriented secondary entry points: medication-first, full-stack, and herb library */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm lg:justify-start">
            <Link
              href="/medications"
              className="inline-flex min-h-9 items-center gap-1 font-medium text-primary underline underline-offset-4 transition-colors hover:text-primary/80"
            >
              {locale === "fr"
                ? "Commencer par mon médicament"
                : "Start with my medication"}{" "}
              →
            </Link>
            <Link
              href="/herb-drug-interactions#stack-checker"
              className="inline-flex min-h-9 items-center gap-1 font-medium text-foreground transition-colors hover:text-primary"
            >
              {locale === "fr"
                ? "Vérifier plusieurs plantes"
                : "Check full supplement stack"}{" "}
              →
            </Link>
            <Link
              href="/herbs"
              className="inline-flex min-h-9 items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("home.heroButton")} →
            </Link>
          </div>
        </div>

        {/* The checker reads as one tool, not a stack of loose fields:
            a hairline panel groups the labels, inputs and the button, and its
            top edge now aligns with the headline instead of sitting 24px
            below it. */}
        <InteractionChecker className="w-full" showBrowseLink={false} />
      </div>

      {/* Clear Safety & Evidence Orientation upfront */}
      <section
        aria-labelledby="how-to-read-heading"
        className="mx-auto w-full max-w-5xl px-4 pb-2 sm:px-6"
      >
        <h2
          id="how-to-read-heading"
          className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {locale === "fr"
            ? "Comment interpréter HerbAlly en toute sécurité"
            : "How to Read HerbAlly Safely"}
        </h2>
        <div className="grid gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-semibold text-foreground">
              {locale === "fr"
                ? "1. Absence ≠ sécurité"
                : "1. Missing record ≠ safe"}
            </p>
            <p className="mt-0.5 text-muted-foreground">
              {locale === "fr"
                ? "Un couple absent de la base ne prouve jamais qu'il est sûr — vérifiez avec un pharmacien."
                : "If an herb–drug pair is absent from our table, that never proves it is safe to combine."}
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">
              {locale === "fr"
                ? "2. Base vs explication IA"
                : "2. Curated DB vs AI help"}
            </p>
            <p className="mt-0.5 text-muted-foreground">
              {locale === "fr"
                ? "Les fiches sourcées viennent des monographies ; l'Herboriste Virtuel est un assistant IA éducatif."
                : "Structured records cite regulatory & PubMed sources; the Virtual Herbalist is an educational AI assistant."}
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">
              {locale === "fr"
                ? "3. Statut de révision affiché"
                : "3. Review status upfront"}
            </p>
            <p className="mt-0.5 text-muted-foreground">
              {locale === "fr"
                ? "Chaque fiche indique si elle a été vérifiée par sources ou approuvée par un clinicien agréé."
                : "Legacy interactions clearly flag when they await independent licensed clinician sign-off."}
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">
              {locale === "fr"
                ? "4. Alimentaire vs extrait"
                : "4. Culinary vs extracts"}
            </p>
            <p className="mt-0.5 text-muted-foreground">
              {locale === "fr"
                ? "Épices culinaires et extraits concentrés diffèrent — destiné au public préparant une visite médicale."
                : "Food-level amounts differ from concentrated extracts; built to prepare pharmacist/doctor questions."}
            </p>
          </div>
        </div>
      </section>

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
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f.href}>
              <Link
                href={f.href}
                className="block h-full rounded-2xl border bg-card p-4 text-left transition-colors hover:border-primary/40"
              >
                <f.icon className="size-5 text-primary" aria-hidden="true" />
                <p className="mt-2 font-semibold text-foreground">
                  {t(f.titleKey)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(f.descKey)}
                </p>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-2xl border border-border/80 bg-muted/30 px-4 py-3 text-xs sm:text-sm">
          <Link
            href="/herb-drug-interactions#stack-checker"
            className="font-medium text-primary hover:underline"
          >
            {t("home.stackLinkLabel")} →
          </Link>
          <span className="text-border" aria-hidden="true">
            •
          </span>
          <Link
            href="/npn-checker"
            className="font-medium text-primary hover:underline"
          >
            {t("home.npnLinkLabel")} →
          </Link>
        </div>

        <h3 className="mt-10 text-center text-lg font-semibold text-foreground">
          {t("home.popularTitle")}
        </h3>
        <ul className="mt-4 flex flex-wrap justify-center gap-2">
          {POPULAR_HERBS.map((h) => (
            <li key={h.slug}>
              <Link
                href={`/herbs/${h.slug}`}
                className="inline-block rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors"
              >
                {t(h.nameKey)}
              </Link>
            </li>
          ))}
        </ul>

        <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed text-muted-foreground">
          {t("home.explainerNote")}
        </p>
      </section>

      {/* Editorial: what the checker does and does not do. Server-rendered prose
          is what a crawler (and a first-time visitor) can actually judge the
          site on — the tool alone gives neither one anything to read. */}
      <HowItWorks locale={locale} />
    </>
  );
}
