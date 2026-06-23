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
import { ProvenanceBadge } from "@/components/herbs/provenance-badge";
import { parseProvenance } from "@/lib/types/provenance";
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
    pregnancy_safe_oral?: boolean | null;
    pregnancy_safe_topical?: boolean | null;
    nursing_safe_oral?: boolean | null;
    nursing_safe_topical?: boolean | null;
    herb_categories?: { name: string } | null;
    evidence_level?: string | null;
    traditional_uses?: string[] | null;
  };
  provenance?: Record<string, unknown> | null;
}

export function HerbHeroV2({ herb, provenance = null }: HerbHeroV2Props) {
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
    <div className="relative overflow-hidden rounded-2xl border bg-card">
      <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:gap-6 sm:p-6">
        <div className="shrink-0 mx-auto sm:mx-0">
          <div className="relative">
            <HerbImage
              name={herb.name}
              imageUrl={herb.image_url}
              className="size-24 rounded-xl shadow-sm sm:size-28 object-cover"
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

        <div className="flex-1 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            {herb.herb_categories?.name && (
              <Badge variant="secondary" className="text-xs">
                {herb.herb_categories.name}
              </Badge>
            )}
            <EvidenceGrade
              level={
                herb.evidence_level &&
                ["A", "B", "C", "D", "trad"].includes(herb.evidence_level)
                  ? (herb.evidence_level as "A" | "B" | "C" | "D" | "trad")
                  : "trad"
              }
            />
            <ProvenanceBadge provenance={parseProvenance(provenance)} />
          </div>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {herb.name}
          </h1>
          <p className="mt-1 text-sm italic text-muted-foreground">
            {herb.scientific_name}
          </p>

          {firstBenefit && (
            <div className="mt-2 inline-flex items-center rounded-full bg-primary/5 px-3 py-1 text-xs text-primary">
              <Check className="mr-1 size-3" />
              {firstBenefit}
            </div>
          )}

          <div className="mt-3 flex flex-col gap-2">
            {/* Pregnancy safety */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                {t("herbHero.pregnancy")}
              </span>
              <span className="inline-flex items-center gap-1 text-xs">
                {herb.pregnancy_safe_oral === false &&
                herb.pregnancy_safe_topical === true ? (
                  <>
                    <ShieldX className="size-3 text-destructive" />
                    <span className="text-destructive">
                      {t("herbHero.unsafeOrally")}
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <ShieldCheck className="size-3 text-green-600" />
                    <span className="text-green-600">
                      {t("herbHero.safeTopically")}
                    </span>
                  </>
                ) : herb.pregnancy_safe ? (
                  <>
                    <ShieldCheck className="size-3 text-green-600" />
                    <span className="text-green-600">
                      {t("herbHero.generallySafe")}
                    </span>
                  </>
                ) : herb.pregnancy_safe === false ? (
                  <>
                    <ShieldX className="size-3 text-destructive" />
                    <span className="text-destructive">
                      {t("herbHero.notSafe")}
                    </span>
                  </>
                ) : (
                  <>
                    <ShieldX className="size-3 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {t("herbHero.unknown")}
                    </span>
                  </>
                )}
              </span>
            </div>
            {/* Nursing safety */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                {t("herbHero.nursing")}
              </span>
              <span className="inline-flex items-center gap-1 text-xs">
                {herb.nursing_safe_oral === false &&
                herb.nursing_safe_topical === true ? (
                  <>
                    <ShieldX className="size-3 text-destructive" />
                    <span className="text-destructive">
                      {t("herbHero.unsafeOrally")}
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <ShieldCheck className="size-3 text-green-600" />
                    <span className="text-green-600">
                      {t("herbHero.safeTopically")}
                    </span>
                  </>
                ) : herb.nursing_safe ? (
                  <>
                    <ShieldCheck className="size-3 text-green-600" />
                    <span className="text-green-600">
                      {t("herbHero.generallySafe")}
                    </span>
                  </>
                ) : herb.nursing_safe === false ? (
                  <>
                    <ShieldX className="size-3 text-destructive" />
                    <span className="text-destructive">
                      {t("herbHero.notSafe")}
                    </span>
                  </>
                ) : (
                  <>
                    <ShieldX className="size-3 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {t("herbHero.unknown")}
                    </span>
                  </>
                )}
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <Button
              size="sm"
              render={<Link href={`/herbalist?herb=${herb.slug}`} />}
              className="rounded-full"
            >
              <MessageCircle className="mr-1 size-3" />
              {t("herbDetail.askHerbalist")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              render={<Link href={`/calculator?herb=${herb.slug}`} />}
              className="rounded-full"
            >
              <Calculator className="mr-1 size-3" />
              {t("herbDetail.calculateDose")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
