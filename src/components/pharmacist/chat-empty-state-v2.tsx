"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Sparkles,
  Moon,
  Shield,
  Heart,
  Calculator,
  Flame,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { getStreak } from "@/lib/garden/streaks";
import { getExploredHerbs } from "@/lib/garden/streaks";
import { getDailyHerb } from "@/lib/garden/daily-herb";

interface ChatEmptyStateV2Props {
  onSendMessage: (text: string) => void;
}

const POPULAR_HERBS = [
  { slug: "turmeric", name: "Turmeric", benefit: "Anti-inflammatory" },
  { slug: "chamomile", name: "Chamomile", benefit: "Calming & sleep" },
  { slug: "ginger", name: "Ginger", benefit: "Digestion & nausea" },
  { slug: "lavender", name: "Lavender", benefit: "Relaxation" },
  { slug: "echinacea", name: "Echinacea", benefit: "Immune support" },
  { slug: "ashwagandha", name: "Ashwagandha", benefit: "Stress relief" },
];

export function ChatEmptyStateV2({ onSendMessage }: ChatEmptyStateV2Props) {
  const t = useTranslations();
  const [streak, setStreak] = useState({ current: 0, longest: 0 });
  const [recentHerbs, setRecentHerbs] = useState<string[]>([]);
  const [dailyHerb, setDailyHerb] = useState<{
    slug: string;
    name: string;
    scientific_name: string;
    benefit: string;
  } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setStreak(getStreak());
    setRecentHerbs(getExploredHerbs().slice(0, 3));

    // Seed daily herb if none exists
    const existing = getDailyHerb();
    if (existing) {
      setDailyHerb(existing);
    } else {
      // Deterministic daily pick based on day of year
      const dayOfYear = Math.floor(
        (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      const pick = POPULAR_HERBS[dayOfYear % POPULAR_HERBS.length];
      if (pick) {
        const dh = {
          ...pick,
          scientific_name: "",
          image_url: null,
        };
        import("@/lib/garden/daily-herb").then(({ setDailyHerb: sdh }) => {
          sdh(dh);
        });
        setDailyHerb(dh);
      }
    }
  }, []);

  const suggestionCards = useMemo(
    () => [
      {
        icon: Moon,
        text: t("pharmacist.suggestedQuestions.0"),
        gradient: "from-indigo-500/10 to-purple-500/10",
      },
      {
        icon: Shield,
        text: t("pharmacist.suggestedQuestions.1"),
        gradient: "from-amber-500/10 to-orange-500/10",
      },
      {
        icon: Heart,
        text: t("pharmacist.suggestedQuestions.2"),
        gradient: "from-rose-500/10 to-pink-500/10",
      },
      {
        icon: Calculator,
        text: t("pharmacist.suggestedQuestions.3"),
        gradient: "from-teal-500/10 to-emerald-500/10",
      },
    ],
    [t]
  );

  const stats = [
    { value: "2,700+", label: t("home.stats.herbs") },
    { value: "500+", label: t("home.stats.interactions") },
    { value: "100%", label: t("home.stats.free") },
  ];

  if (!mounted) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-6 animate-pulse">
        <div className="mb-6 h-8 w-48 rounded-full bg-muted" />
        <div className="mb-2 h-10 w-72 rounded-lg bg-muted" />
        <div className="mb-8 h-4 w-56 rounded bg-muted" />
        <div className="w-full max-w-xl h-14 rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center px-4 py-8 min-h-0">
      {/* Streak badge */}
      {streak.current > 1 && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-warning/20 bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
          <Flame className="size-3.5" />
          {streak.current}-day streak!
        </div>
      )}

      {/* Badge */}
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary backdrop-blur-sm">
        <Sparkles className="size-4" />
        <span>{t("homeAI.badge")}</span>
      </div>

      {/* Heading */}
      <h1 className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {t("homeAI.title")}
      </h1>
      <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
        {t("homeAI.subtitle")}
      </p>

      {/* Today's Herb */}
      {dailyHerb && (
        <div className="mt-6 w-full max-w-xl">
          <Link
            href={`/herbs/${dailyHerb.slug}`}
            className="group flex items-center gap-4 rounded-2xl border border-primary/15 bg-gradient-to-r from-primary/[0.03] to-teal-500/[0.03] p-4 transition-all hover:shadow-md hover:border-primary/25"
          >
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sun className="size-6" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-primary">
                Herb of the Day
              </p>
              <p className="font-semibold text-foreground">{dailyHerb.name}</p>
              <p className="text-xs text-muted-foreground">{dailyHerb.benefit}</p>
            </div>
            <Sparkles className="size-4 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        </div>
      )}

      {/* Recent herbs chips */}
      {recentHerbs.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-muted-foreground">Recent:</span>
          {recentHerbs.map((slug) => (
            <Link
              key={slug}
              href={`/herbs/${slug}`}
              className="rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
            >
              {slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </Link>
          ))}
        </div>
      )}

      {/* Suggestion cards */}
      <div className="mt-6 grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
        {suggestionCards.map((card) => {
          const Icon = card.icon;
          return (
            <Button
              key={card.text}
              type="button"
              variant="ghost"
              onClick={() => onSendMessage(card.text)}
              className={cn(
                "flex h-auto items-center gap-3 rounded-xl border p-4 text-left text-sm font-medium transition-all",
                "bg-gradient-to-br",
                card.gradient,
                "hover:shadow-md hover:scale-[1.02] active:scale-[0.98]",
                "text-foreground border-border/60"
              )}
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background/80">
                <Icon className="size-4 text-primary" />
              </div>
              <span className="line-clamp-2">{card.text}</span>
            </Button>
          );
        })}
      </div>

      {/* Stats */}
      <div className="mt-6 flex items-center gap-3">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            {i > 0 && <span className="text-border">•</span>}
            <span className="font-semibold text-foreground">{stat.value}</span>
            <span className="hidden sm:inline">{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
