import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Leaf, Calculator, ShieldCheck, Sparkles } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { AnimatedCounter } from "@/components/shared/animated-counter";
import { FloatingHerbs } from "@/components/shared/floating-herbs";
import Link from "next/link";

export const metadata: Metadata = {
  title: "HerbAlly — Virtual Herbalist | Medicinal Herbs & Drug Interactions",
  description:
    "Ask our AI herbalist about herb safety, drug interactions, and dosage. Explore 2,700+ medicinal herbs. Evidence-based answers from WHO, NCCIH, and PubMed. Free, no account required.",
  alternates: {
    canonical: process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app",
  },
};

const FEATURE_ICONS = [Leaf, Calculator, ShieldCheck, Sparkles];
const FEATURE_KEYS = ["herbs", "calculator", "interactions", "ai"] as const;

export default async function HomePage() {
  const t = await getTranslations("home");

  return (
    <div className="relative">
      <FloatingHerbs />

      <section className="container mx-auto max-w-6xl px-4 pt-16 pb-12 md:pt-24 md:pb-16">
        <div className="flex flex-col items-center text-center">
          <span className="mb-4 inline-flex items-center rounded-full border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            {t("hero.badge")}
          </span>
          <h1 className="max-w-3xl text-balance text-4xl font-bold tracking-tight text-foreground md:text-6xl">
            {t("hero.title")}
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-lg text-muted-foreground md:text-xl">
            {t("hero.subtitle")}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/herbs"
              className={buttonVariants({ size: "lg" })}
            >
              {t("hero.searchButton")}
            </Link>
            <Link
              href="/herbalist"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              {t("hero.askHerbalistButton")}
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            {(t.raw("hero.trustBadgesList") as string[]).map((badge) => (
              <li key={badge} className="flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
                {badge}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-y bg-muted/30 py-12">
        <div className="container mx-auto max-w-6xl px-4">
          <h2 className="sr-only">{t("stats.heading")}</h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
                <AnimatedCounter value="2,700+" />
              </div>
              <div className="mt-2 text-sm text-muted-foreground">{t("stats.herbs")}</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
                <AnimatedCounter value="500+" />
              </div>
              <div className="mt-2 text-sm text-muted-foreground">{t("stats.interactions")}</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
                <AnimatedCounter value="100%" />
              </div>
              <div className="mt-2 text-sm text-muted-foreground">{t("stats.free")}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {t("features.title")}
          </h2>
          <p className="mt-3 text-muted-foreground md:text-lg">
            {t("features.subtitle")}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {FEATURE_KEYS.map((key, i) => {
            const Icon = FEATURE_ICONS[i];
            return (
              <Card key={key} className="border-border/60 bg-card/50 backdrop-blur">
                <CardHeader>
                  <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <CardTitle>{t(`features.${key}.title`)}</CardTitle>
                  <CardDescription>{t(`features.${key}.description`)}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="border-t bg-muted/30 py-16">
        <div className="container mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {t("cta.title")}
          </h2>
          <p className="mt-3 text-muted-foreground md:text-lg">
            {t("cta.subtitle")}
          </p>
          <div className="mt-8">
            <Link
              href="/herbs"
              className={buttonVariants({ size: "lg" })}
            >
              {t("cta.button")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
