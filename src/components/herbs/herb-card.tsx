"use client";

import Link from "next/link";
import { trackEvent } from "@/lib/analytics";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { HerbImage } from "@/components/herbs/HerbImage";
import { cn } from "@/lib/utils";

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
  return (
    <Card className={cn("group transition-colors hover:border-primary/30", className)}>
      <Link
        href={`/herbs/${herb.slug}`}
        onClick={() => trackEvent("herb_viewed", { slug: herb.slug })}
        className="block"
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <HerbImage
              name={herb.name}
              imageUrl={herb.image_url}
              className="size-12 shrink-0 rounded-lg"
            />
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-foreground truncate">
                {herb.name}
              </h3>
              <p className="text-xs italic text-muted-foreground truncate">
                {herb.scientific_name}
              </p>
              {herb.traditional_uses?.[0] && (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                  {herb.traditional_uses[0]}
                </p>
              )}
            </div>
            <ArrowRight className="size-4 shrink-0 self-center text-muted-foreground/40 group-hover:text-primary transition-colors" />
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
