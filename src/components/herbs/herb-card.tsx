"use client";

import Link from "next/link";
import { trackEvent } from "@/lib/analytics";
import {
  ArrowRight,
  Leaf,
  Flower2,
  TreePine,
  Sprout,
  Cherry,
  Bean,
  Droplets,
  Heart,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HerbImage } from "@/components/herbs/HerbImage";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  addToGarden,
  removeFromGarden,
  isInGarden,
} from "@/lib/garden/local-garden";

const categoryIconMap: Record<string, keyof typeof IconComponents> = {
  adaptogen: "Sprout",
  flower: "Flower2",
  tree: "TreePine",
  berry: "Cherry",
  root: "Bean",
  oil: "Droplets",
};

function getCategoryIconKey(
  category?: string | null
): keyof typeof IconComponents {
  if (!category) return "Leaf";
  const lower = category.toLowerCase();
  for (const [key, iconKey] of Object.entries(categoryIconMap)) {
    if (lower.includes(key)) return iconKey;
  }
  return "Leaf";
}

const IconComponents = {
  Leaf,
  Sprout,
  Flower2,
  TreePine,
  Cherry,
  Bean,
  Droplets,
} as const;

const safetyColorMap = {
  safe: "bg-success",
  caution: "bg-warning",
  unsafe: "bg-destructive",
} as const;

function getSafetyLevel(
  pregnancySafe: boolean | null,
  nursingSafe: boolean | null
): "safe" | "caution" | "unsafe" {
  if (pregnancySafe && nursingSafe) return "safe";
  if (pregnancySafe === false && nursingSafe === false) return "unsafe";
  if (pregnancySafe === false || nursingSafe === false) return "caution";
  return "caution";
}

interface HerbCardProps {
  herb: {
    id: string;
    name: string;
    scientific_name: string;
    slug: string;
    description: string;
    pregnancy_safe: boolean | null;
    nursing_safe: boolean | null;
    dosage_adult?: string | null;
    traditional_uses?: string[] | null;
    herb_categories?: { name: string } | null;
    updated_at?: string;
    image_url?: string | null;
  };
  className?: string;
}

export function HerbCard({ herb, className }: HerbCardProps) {
  const t = useTranslations();
  const safetyLevel = getSafetyLevel(herb.pregnancy_safe, herb.nursing_safe);
  const CategoryIcon =
    IconComponents[getCategoryIconKey(herb.herb_categories?.name)];
  const primaryBenefit = herb.traditional_uses?.[0];

  const [saved, setSaved] = useState(() => isInGarden(herb.slug));

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
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

  return (
    <Card
      className={cn(
        "group relative h-full overflow-hidden transition-shadow transition-transform duration-300 hover:shadow-xl hover:-translate-y-1 border-border/50 rounded-2xl",
        className
      )}
    >
      {/* Top gradient accent */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-1 opacity-80 transition-opacity group-hover:opacity-100",
          safetyLevel === "safe" && "bg-gradient-to-r from-success to-primary",
          safetyLevel === "caution" && "bg-gradient-to-r from-warning to-chart-4",
          safetyLevel === "unsafe" && "bg-gradient-to-r from-destructive to-chart-5"
        )}
      />

      {/* Save button — outside Link to avoid nested interactive elements */}
      <button
        onClick={handleSave}
        className={cn(
          "absolute right-3 top-3 z-10 flex size-10 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm shadow-sm transition-transform hover:scale-110 hover:shadow-md",
          saved
            ? "text-rose-500"
            : "text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-rose-500"
        )}
        aria-label={saved ? t("garden.remove") : t("garden.saved")}
      >
        <Heart className={cn("size-5", saved && "fill-current")} />
      </button>

      {/* Hover gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <Link
        href={`/herbs/${herb.slug}`}
        onClick={() => trackEvent("herb_viewed", { slug: herb.slug })}
        className="block"
        aria-label={`${herb.name}`}
      >
        <CardContent className="relative p-5">
          <div className="flex items-start gap-4">
            <HerbImage
              name={herb.name}
              imageUrl={herb.image_url}
              className="size-14 shrink-0 rounded-xl shadow-sm transition-shadow transition-transform duration-300 group-hover:shadow-md group-hover:scale-105"
            />
            <div className="flex-1 min-w-0 pr-8">
              <div className="mb-2 flex items-center gap-2">
                {herb.herb_categories?.name ? (
                  <Badge
                    variant="secondary"
                    className="text-xs font-medium gap-1 rounded-full"
                  >
                    <CategoryIcon className="size-3" />
                    {herb.herb_categories.name}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs rounded-full">
                    <Leaf className="mr-1 size-3" />
                    {t("herbBadges.herb")}
                  </Badge>
                )}
              </div>

              <h3 className="mb-0.5 text-lg font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                {herb.name}
              </h3>
              <p className="text-sm italic text-muted-foreground truncate">
                {herb.scientific_name}
              </p>
            </div>
          </div>

          {/* Primary benefit chip */}
          {primaryBenefit && (
            <div className="mt-3">
              <span className="inline-flex items-center rounded-full bg-primary/5 px-3 py-1 text-xs text-primary/80">
                {primaryBenefit}
              </span>
            </div>
          )}

          {/* Bottom row: safety dot + arrow */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "size-2.5 rounded-full",
                  safetyColorMap[safetyLevel]
                )}
                title={
                  safetyLevel === "safe"
                    ? t("herbBadges.safetySafe")
                    : safetyLevel === "unsafe"
                    ? t("herbBadges.safetyUnsafe")
                    : t("herbBadges.safetyCaution")
                }
              />
              <span className="text-xs text-muted-foreground">
                {safetyLevel === "safe"
                  ? t("herbBadges.safetySafe")
                  : safetyLevel === "unsafe"
                  ? t("herbBadges.safetyUnsafe")
                  : t("herbBadges.safetyCaution")}
              </span>
            </div>

            <ArrowRight className="size-4 text-muted-foreground/50 transition-transform transition-colors duration-300 group-hover:translate-x-1 group-hover:text-primary" />
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
