"use client";

import { Leaf, Calculator, ShieldCheck, Sparkles } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { AnimatedCounter } from "@/components/shared/animated-counter";
import { FloatingHerbs } from "@/components/shared/floating-herbs";
import Link from "next/link";

type Labels = {
  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  heroSearchButton: string;
  heroAskHerbalistButton: string;
  trustBadges: string[];
  statsHeading: string;
  statsHerbs: string;
  statsInteractions: string;
  statsFree: string;
  featuresTitle: string;
  featuresSubtitle: string;
  ctaTitle: string;
  ctaSubtitle: string;
  ctaButton: string;
  featureHerbsTitle: string;
  featureHerbsDescription: string;
  featureCalculatorTitle: string;
  featureCalculatorDescription: string;
  featureInteractionsTitle: string;
  featureInteractionsDescription: string;
  featureAiTitle: string;
  featureAiDescription: string;
};

const FEATURES = [
  { key: "herbs", Icon: Leaf },
  { key: "calculator", Icon: Calculator },
  { key: "interactions", Icon: ShieldCheck },
  { key: "ai", Icon: Sparkles },
] as const;

export function HomePageClient({ labels }: { labels: Labels }) {
  return (
    <div className="relative">
      <FloatingHerbs />

      <section className="container mx-auto max-w-6xl px-4 pt-16 pb-12 md:pt-24 md:pb-16">
        <div className="flex flex-col items-center text-center">
          <span className="mb-4 inline-flex items-center rounded-full border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            {labels.heroBadge}
          </span>
          <h1 className="max-w-3xl text-balance text-4xl font-bold tracking-tight text-foreground md:text-6xl">
            {labels.heroTitle}
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-lg text-muted-foreground md:text-xl">
            {labels.heroSubtitle}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/herbs" className={buttonVariants({ size: "lg" })}>
              {labels.heroSearchButton}
            </Link>
            <Link
              href="/herbalist"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              {labels.heroAskHerbalistButton}
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            {labels.trustBadges.map((badge) => (
              <li key={badge} className="flex items-center gap-1.5">
                <ShieldCheck
                  className="size-3.5 text-primary"
                  aria-hidden="true"
                />
                {badge}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-y bg-muted/30 py-12">
        <div className="container mx-auto max-w-6xl px-4">
          <h2 className="sr-only">{labels.statsHeading}</h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
                <AnimatedCounter value="2,700+" />
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {labels.statsHerbs}
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
                <AnimatedCounter value="500+" />
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {labels.statsInteractions}
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
                <AnimatedCounter value="100%" />
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {labels.statsFree}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {labels.featuresTitle}
          </h2>
          <p className="mt-3 text-muted-foreground md:text-lg">
            {labels.featuresSubtitle}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {FEATURES.map(({ key, Icon }) => (
            <Card
              key={key}
              className="border-border/60 bg-card/50 backdrop-blur"
            >
              <CardHeader>
                <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <CardTitle>
                  {labels[`feature${key.charAt(0).toUpperCase() + key.slice(1)}Title` as keyof Labels]}
                </CardTitle>
                <CardDescription>
                  {
                    labels[
                      `feature${key.charAt(0).toUpperCase() + key.slice(1)}Description` as keyof Labels
                    ]
                  }
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t bg-muted/30 py-16">
        <div className="container mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {labels.ctaTitle}
          </h2>
          <p className="mt-3 text-muted-foreground md:text-lg">
            {labels.ctaSubtitle}
          </p>
          <div className="mt-8">
            <Link href="/herbs" className={buttonVariants({ size: "lg" })}>
              {labels.ctaButton}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
