"use client";

import Link from "next/link";
import { trackEvent } from "@/lib/analytics";
import {
  ArrowRight,
  Calculator,
  Leaf,
  Flower2,
  TreePine,
  Sprout,
  Cherry,
  Bean,
  Droplets,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HerbSafetyBadges } from "@/components/herbs/herb-safety-badges";
import { HerbImage } from "@/components/herbs/herb-image";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

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

// Predefined icons to avoid creating components during render
const IconComponents = {
  Leaf,
  Sprout,
  Flower2,
  TreePine,
  Cherry,
  Bean,
  Droplets,
} as const;

function getSafetyLevel(
  pregnancySafe: boolean | null,
  nursingSafe: boolean | null
): "safe" | "caution" | "unsafe" {
  if (pregnancySafe && nursingSafe) return "safe";
  if (pregnancySafe === false && nursingSafe === false) return "unsafe";
  if (pregnancySafe === false || nursingSafe === false) return "caution";
  return "caution"; // null = unknown = caution
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

const safetyColorMap = {
  safe: "from-green-500 to-emerald-500",
  caution: "from-amber-500 to-yellow-500",
  unsafe: "from-red-500 to-orange-500",
} as const;

export function HerbCard({ herb, className }: HerbCardProps) {
  const t = useTranslations();
  const safetyLevel = getSafetyLevel(herb.pregnancy_safe, herb.nursing_safe);
  const CategoryIcon =
    IconComponents[getCategoryIconKey(herb.herb_categories?.name)];
  const primaryBenefit = herb.traditional_uses?.[0];

  const safetyLabelKey =
    safetyLevel === "safe"
      ? "herbBadges.safetySafe"
      : safetyLevel === "unsafe"
        ? "herbBadges.safetyUnsafe"
        : "herbBadges.safetyCaution";

  return (
    <Link
      href={`/herbs/${herb.slug}`}
      onClick={() => trackEvent("herb_viewed", { slug: herb.slug })}
      className="group"
      aria-label={`${herb.name}. ${t(safetyLabelKey)}`}
    >
      <Card
        className={cn(
          "card-press relative h-full overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1.5 border-border/50",
          safetyLevel === "safe" && "safety-border-safe",
          safetyLevel === "caution" && "safety-border-caution",
          safetyLevel === "unsafe" && "safety-border-unsafe",
          className
        )}
      >
        {/* Top gradient accent with safety-aware color */}
        <div
          className={cn(
            "absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-80 transition-opacity group-hover:opacity-100",
            safetyColorMap[safetyLevel]
          )}
        />

        {/* Hover gradient reveal */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <CardContent className="relative p-5">
          <div className="flex items-start gap-4">
            <HerbImage
              name={herb.name}
              imageUrl={herb.image_url}
              className="size-14 shrink-0 rounded-lg shadow-sm transition-all duration-300 group-hover:shadow-md group-hover:scale-105"
            />
            <div className="flex-1 min-w-0">
              {/* Category Badge */}
              <div className="mb-2">
                {herb.herb_categories?.name ? (
                  <Badge
                    variant="secondary"
                    className="text-xs font-medium gap-1"
                  >
                    <CategoryIcon className="size-3" />
                    {herb.herb_categories.name}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    <Leaf className="mr-1 size-3" />
                    {t("herbBadges.herb")}
                  </Badge>
                )}
              </div>

              {/* Title */}
              <h3 className="mb-1 text-lg font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                {herb.name}
              </h3>
              <p className="text-sm italic text-muted-foreground truncate">
                {herb.scientific_name}
              </p>
            </div>
          </div>

          {/* Description */}
          <p className="mt-3 line-clamp-2 break-words text-sm text-muted-foreground">
            {herb.description}
          </p>

          {/* Key info preview */}
          {(herb.dosage_adult || primaryBenefit) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {primaryBenefit && (
                <span className="inline-flex items-center rounded-md bg-primary/5 px-2 py-0.5 text-xs text-primary/80">
                  {primaryBenefit}
                </span>
              )}
              {herb.dosage_adult && (
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  <Calculator className="size-3" />
                  {herb.dosage_adult}
                </span>
              )}
            </div>
          )}

          {/* Safety Badges + Arrow */}
          <div className="mt-4 flex items-center justify-between">
            <HerbSafetyBadges
              pregnancySafe={herb.pregnancy_safe ?? false}
              nursingSafe={herb.nursing_safe ?? false}
            />
            <ArrowRight className="size-4 text-muted-foreground/50 transition-all duration-300 group-hover:translate-x-1 group-hover:text-primary" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
