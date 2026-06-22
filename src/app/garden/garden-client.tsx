"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Sprout,
  Flame,
  Search,
  Trash2,
  Leaf,
  Stethoscope,
  Heart,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getGarden,
  removeFromGarden,
  mergeServerGarden,
  type GardenHerb,
} from "@/lib/garden/local-garden";
import { recordVisit, getExploredCount } from "@/lib/garden/streaks";
import { HerbImage } from "@/components/herbs/HerbImage";
import { useTranslations, useLocale } from "next-intl";

export function GardenClient() {
  const t = useTranslations();
  const locale = useLocale();
  const [garden, setGarden] = useState<GardenHerb[]>(() => getGarden());
  const [streak] = useState(() => recordVisit());
  const [explored] = useState(() => getExploredCount());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  // Merge server-side garden into localStorage on mount
  useEffect(() => {
    if (!mounted) return;
    mergeServerGarden().then((merged) => {
      if (merged.length !== garden.length) {
        setGarden(merged);
      }
    });
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  const handleRemove = useCallback((slug: string) => {
    const updated = removeFromGarden(slug);
    setGarden(updated);
  }, []);

  if (!mounted) {
    return (
      <div className="space-y-8">
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const hasGarden = garden.length > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {t("garden.title") || "My Garden"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {t("garden.subtitle") ||
            "Your personal collection of herbs and discoveries."}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card/50 p-5 transition-all hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sprout className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {garden.length}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("garden.savedHerbs") || "Saved Herbs"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-card/50 p-5 transition-all hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-warning/10 text-warning">
              <Flame className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {streak.current}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("garden.dayStreak") || "Day Streak"}
                {streak.current >= streak.longest && streak.current > 1 && (
                  <span className="ml-1 text-xs text-warning">
                    {t("garden.best") || "Best!"}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-card/50 p-5 transition-all hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-info/10 text-info">
              <Search className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{explored}</p>
              <p className="text-sm text-muted-foreground">
                {t("garden.explored") || "Explored"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Saved Herbs */}
      {hasGarden ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">
            {t("garden.yourCollection") || "Your Collection"}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {garden
              .filter((herb) => herb && herb.slug)
              .map((herb) => (
              <div
                key={herb.slug}
                className="group relative overflow-hidden rounded-2xl border bg-card transition-all hover:shadow-lg hover:-translate-y-1"
              >
                <Link
                  href={`/herbs/${herb.slug}`}
                  className="flex items-start gap-4 p-4"
                >
                  <HerbImage
                    name={herb.name}
                    imageUrl={herb.image_url}
                    className="size-14 shrink-0 rounded-xl shadow-sm transition-transform group-hover:scale-105"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {herb.name}
                    </h3>
                    <p className="text-sm italic text-muted-foreground truncate">
                      {herb.scientific_name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(herb.savedAt).toLocaleDateString(
                        locale === "fr" ? "fr-FR" : "en-US"
                      )}
                    </p>
                  </div>
                </Link>
                <button
                  onClick={() => handleRemove(herb.slug)}
                  className="absolute right-2 top-2 flex size-10 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  aria-label={`${t("garden.remove")} ${herb.name}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed bg-muted/30 p-10 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
            <Sprout className="size-8" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            {t("garden.emptyTitle") || "Your garden is empty"}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
            {t("garden.emptyDesc") ||
              "Save herbs you discover to build your personal collection. Tap the heart icon on any herb card."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button render={<Link href="/herbs" />}>
              <Leaf className="size-4 mr-2" />
              {t("garden.exploreHerbs") || "Explore Herbs"}
            </Button>
            <Button variant="outline" render={<Link href="/" />}>
              <Stethoscope className="size-4 mr-2" />
              {t("garden.askHerbalist") || "Ask Herbalist"}
            </Button>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/herbs"
          className="group flex items-center gap-4 rounded-2xl border bg-card/50 p-5 transition-all hover:shadow-md hover:bg-card"
        >
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <BookOpen className="size-5" />
          </div>
          <div>
            <p className="font-medium text-foreground">
              {t("garden.browseHerbs") || "Browse Herbs"}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("garden.browseHerbsDesc") ||
                "Discover new herbs from our database"}
            </p>
          </div>
        </Link>
        <Link
          href="/"
          className="group flex items-center gap-4 rounded-2xl border bg-card/50 p-5 transition-all hover:shadow-md hover:bg-card"
        >
          <div className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive transition-colors group-hover:bg-destructive group-hover:text-destructive-foreground">
            <Heart className="size-5" />
          </div>
          <div>
            <p className="font-medium text-foreground">
              {t("garden.talkToHerbalist") || "Talk to Herbalist"}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("garden.talkToHerbalistDesc") ||
                "Ask questions and get personalized guidance"}
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
