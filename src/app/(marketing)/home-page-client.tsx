"use client";

import { Leaf, Calculator, ShieldCheck, Sparkles, MessageCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";

type Labels = {
  heroTitle: string;
  heroSubtitle: string;
  heroButton: string;
  heroSecondary: string;
  featuresTitle: string;
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
  { key: "herbs", Icon: Leaf, href: "/herbs" },
  { key: "calculator", Icon: Calculator, href: "/calculator" },
  { key: "interactions", Icon: ShieldCheck, href: "/herbalist" },
  { key: "ai", Icon: MessageCircle, href: "/herbalist" },
] as const;

export function HomePageClient({ labels }: { labels: Labels }) {
  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-3xl px-4 pb-16 pt-16 text-center sm:pt-24 sm:pb-20">
        <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          {labels.heroTitle}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
          {labels.heroSubtitle}
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/herbs" className={buttonVariants({ size: "lg" })}>
            {labels.heroButton}
          </Link>
          <Link
            href="/herbalist"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            {labels.heroSecondary}
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border/50 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="mb-10 text-center text-2xl font-semibold tracking-tight text-foreground">
            {labels.featuresTitle}
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {FEATURES.map(({ key, Icon, href }) => (
              <Link
                key={key}
                href={href}
                className="group flex gap-4 rounded-xl border border-border/60 p-5 transition-colors hover:border-primary/30 hover:bg-accent/30"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Icon className="size-5" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">
                    {
                      labels[
                        `feature${key.charAt(0).toUpperCase() + key.slice(1)}Title` as keyof Labels
                      ]
                    }
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {
                      labels[
                        `feature${key.charAt(0).toUpperCase() + key.slice(1)}Description` as keyof Labels
                      ]
                    }
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-border/50 py-16 text-center">
        <div className="mx-auto max-w-lg px-4">
          <p className="text-sm font-medium text-muted-foreground">
            Free to use. No account required. Evidence-based.
          </p>
        </div>
      </section>
    </div>
  );
}
