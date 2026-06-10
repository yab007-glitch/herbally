"use client";

import Link from "next/link";
import {
  MessageCircle,
  Calculator,
  Heart,
  ShieldCheck,
  ShieldX,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HerbImage } from "@/components/herbs/HerbImage";
import { EvidenceGrade } from "@/components/herbs/evidence-grade";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import {
  addToGarden,
  removeFromGarden,
  isInGarden,
} from "@/lib/garden/local-garden";
import { recordHerbExplored } from "@/lib/garden/streaks";

interface HerbHeroV2Props {
  herb: {
    id: string;
    slug: string;
    name: string;
    scientific_name: string;
    description: string;
    image_url?: string | null;
    pregnancy_safe: boolean | null;
    nursing_safe: boolean | null;
    herb_categories?: { name: string } | null;
    evidence_level?: string | null;
    traditional_uses?: string[] | null;
  };
}

export function HerbHeroV2({ herb }: HerbHeroV2Props) {
  const t = useTranslations();
  const [saved, setSaved] = useState(() => isInGarden(herb.slug));

  useEffect(() => {
    recordHerbExplored(herb.slug);
  }, [herb.slug]);

  const handleSave = () => {
    if (saved) {
      removeFromGarden(herb.slug);
      setSaved(false);
    } else {
      addToGarden({
        id: herb.id,
        slug: herb.slug,
        name: herb.name,
        scientific_name: herb.scientific_name,
        image_url: herb.image_url,
      });
      setSaved(true);
    }
  };

  const firstBenefit = herb.traditional_uses?.[0];

  return (
    <div className="relative overflow-hidden rounded-3xl border bg-card">
      {/* Organic shape background accent */}
      <div className="absolute -right-20 -top-20 size-64 rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute -left-10 -bottom-10 size-48 rounded-full bg-teal-500/5 blur-2xl" />

      <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:gap-8 sm:p-8">
        {/* Herb Image */}
        <div className="shrink-0 mx-auto sm:mx-0">
          <div className="relative">
            <HerbImage
              name={herb.name}
              imageUrl={herb.image_url}
              className="size-28 rounded-2xl shadow-lg sm:size-32 object-cover"
            />
            <button
              onClick={handleSave}
              className={cn(
                "absolute -right-2 -top-2 flex size-8 items-center justify-center rounded-full shadow-md transition-transform hover:scale-110",
                saved
                  ? "bg-rose-500 text-white"
                  : "bg-background text-muted-foreground hover:text-rose-500"
              )}
              aria-label={saved ? t("garden.remove") : t("garden.saved")}
            >
              <Heart className={cn("size-4", saved && "fill-white")} />
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            {herb.herb_categories?.name && (
              <Badge variant="secondary" className="text-xs">
                {herb.herb_categories.name}
              </Badge>
            )}
            <EvidenceGrade
              level={
                herb.evidence_level && ["A", "B", "C", "D", "trad"].includes(herb.evidence_level)
                  ? (herb.evidence_level as "A" | "B" | "C" | "D" | "trad")
                  : "C"
              }
            />
          </div>

          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {herb.name}
          </h1>
          <p className="mt-1 text-lg italic text-muted-foreground">
            {herb.scientific_name}
          </p>

          {firstBenefit && (
            <div className="mt-3 inline-flex items-center rounded-full bg-primary/5 px-3 py-1 text-sm text-primary">
              <Check className="mr-1.5 size-3.5" />
              {firstBenefit}
            </div>
          )}

          {/* Safety mini-badges */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
            <span className="inline-flex items-center gap-1.5 text-sm">
              {herb.pregnancy_safe ? (
                <>
                  <ShieldCheck className="size-4 text-success" />
                  <span className="text-success">
                    {t("herbDetail.safePregnancy")}
                  </span>
                </>
              ) : (
                <>
                  <ShieldX className="size-4 text-destructive" />
                  <span className="text-destructive">
                    {t("herbDetail.notSafePregnancy")}
                  </span>
                </>
              )}
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm">
              {herb.nursing_safe ? (
                <>
                  <ShieldCheck className="size-4 text-success" />
                  <span className="text-success">
                    {t("herbDetail.safeNursing")}
                  </span>
                </>
              ) : (
                <>
                  <ShieldX className="size-4 text-destructive" />
                  <span className="text-destructive">
                    {t("herbDetail.notSafeNursing")}
                  </span>
                </>
              )}
            </span>
          </div>

          {/* Quick Actions */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <Button
              size="sm"
              render={<Link href={`/herbalist?herb=${herb.slug}`} />}
              className="rounded-full"
            >
              <MessageCircle className="mr-1.5 size-3.5" />
              {t("herbDetail.askHerbalist") || "Ask Herbalist"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              render={<Link href={`/calculator?herb=${herb.slug}`} />}
              className="rounded-full"
            >
              <Calculator className="mr-1.5 size-3.5" />
              {t("herbDetail.calculateDose") || "Calculate Dose"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
