"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";
import { ArrowRight, Heart, ShieldCheck, ShieldX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { HerbImage } from "@/components/herbs/HerbImage";
import { EvidenceGradeBadge } from "@/components/herbs/evidence-grade";
import { ProvenanceBadge } from "@/components/herbs/provenance-badge";
import { parseProvenance, isVerified } from "@/lib/types/provenance";
import {
  addToGarden,
  removeFromGarden,
  isInGarden,
  subscribeGarden,
} from "@/lib/garden/local-garden";
import { useTranslations } from "next-intl";
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
    evidence_level?: string | null;
    provenance?: unknown;
  };
  className?: string;
}

const EVIDENCE_LEVELS = ["A", "B", "C", "D", "trad"] as const;

export function HerbCard({ herb, className }: HerbCardProps) {
  const t = useTranslations();
  // Garden membership lives in localStorage, so it is read as an external
  // store: the server snapshot is "not saved" and the client snapshot is the
  // real value. A mount effect + setState would render twice for every card
  // (and is what react-hooks/set-state-in-effect rejects); subscribing keeps
  // this card in sync when the same herb is toggled elsewhere on the page or
  // in another tab.
  const saved = useSyncExternalStore(
    subscribeGarden,
    () => isInGarden(herb.slug),
    () => false
  );

  const handleSave = () => {
    if (saved) {
      removeFromGarden(herb.slug);
    } else {
      addToGarden({
        id: herb.id,
        slug: herb.slug,
        name: herb.name,
        scientific_name: herb.scientific_name,
        image_url: herb.image_url,
      });
    }
  };

  // Phase 1 gate: pregnancy/nursing verdicts are only shown for
  // human-verified entries. For unverified entries the verdict is Unknown,
  // never a fabricated "Generally safe" from AI data.
  //
  // Unknown is the default for 95% of the library, so rendering it on every
  // card turned four lines of metadata into wallpaper: measured 20 of 21
  // cards showing the same "Not Common / Pregnancy: Unknown / Nursing:
  // Unknown". A card now shows a safety line only when there is a verdict to
  // show, and the one herb that differs is the one the eye lands on.
  const verified = isVerified(parseProvenance(herb.provenance ?? null));
  const safety = (
    label: string,
    value: boolean | null
  ): { text: string; tone: string; Icon: typeof ShieldCheck } | null => {
    if (!verified || value === null) return null;
    return value
      ? {
          text: `${label}: ${t("herbHero.generallySafe")}`,
          tone: "text-green-600",
          Icon: ShieldCheck,
        }
      : {
          text: `${label}: ${t("herbHero.notSafe")}`,
          tone: "text-destructive",
          Icon: ShieldX,
        };
  };
  const pregnancy = safety(t("herbBadges.pregnancy"), herb.pregnancy_safe);
  const nursing = safety(t("herbBadges.nursing"), herb.nursing_safe);
  const safetyLines = [
    pregnancy && { key: "pregnancy", ...pregnancy },
    nursing && { key: "nursing", ...nursing },
  ].filter(
    (
      line
    ): line is {
      key: string;
      text: string;
      tone: string;
      Icon: typeof ShieldCheck;
    } => line !== null
  );
  // "Not Common" is the bucket 91% of the library falls into. Printing it on
  // a card says nothing; the evidence and provenance pills are what differ.
  const categoryName = herb.herb_categories?.name?.trim();
  const categoryIsBucket =
    !!categoryName && /^(not common|pas courant)$/i.test(categoryName);
  const evidenceLevel = EVIDENCE_LEVELS.includes(
    herb.evidence_level as (typeof EVIDENCE_LEVELS)[number]
  )
    ? (herb.evidence_level as (typeof EVIDENCE_LEVELS)[number])
    : null;

  return (
    <Card
      className={cn(
        "group transition-colors hover:border-primary/30",
        className
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Link
            href={`/herbs/${herb.slug}`}
            onClick={() => trackEvent("herb_viewed", { slug: herb.slug })}
            className="flex min-w-0 flex-1 items-start gap-3"
          >
            {/* HerbImage already renders the photo when image_url exists
                and only falls back to the coloured initial tile otherwise. */}
            <HerbImage
              name={herb.name}
              imageUrl={herb.image_url}
              className="size-12 shrink-0 rounded-lg"
            />
            <div className="min-w-0 flex-1">
              {/* Names wrap instead of truncating mid-word: the full name
                  is always visible (up to two lines) and also in title. */}
              <h3
                title={herb.name}
                className="font-medium text-foreground break-words line-clamp-2"
              >
                {herb.name}
              </h3>
              {/* Half the library is catalogued under its botanical name, so
                  the italic line repeated the title verbatim ("Abies alba" /
                  "Abies alba"). Print it only when it adds something. */}
              {herb.scientific_name?.trim().toLowerCase() !==
                herb.name.trim().toLowerCase() && (
                <p
                  title={herb.scientific_name}
                  className="text-xs italic text-muted-foreground line-clamp-1"
                >
                  {herb.scientific_name}
                </p>
              )}
              {herb.traditional_uses?.[0] && (
                <p
                  title={herb.traditional_uses[0]}
                  className="mt-1 text-xs text-muted-foreground line-clamp-2"
                >
                  {herb.traditional_uses[0]}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {/* The category badge explains why a herb appears under a
                    filter: the card's one-line use is the first traditional
                    use, which need not match the category name. The default
                    bucket is suppressed — it is true of almost every card. */}
                {categoryName && !categoryIsBucket && (
                  <Badge variant="secondary" className="text-xs">
                    {categoryName}
                  </Badge>
                )}
                {evidenceLevel && <EvidenceGradeBadge level={evidenceLevel} />}
                {herb.provenance !== undefined && (
                  <ProvenanceBadge
                    provenance={parseProvenance(herb.provenance)}
                  />
                )}
              </div>
              {safetyLines.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                  {safetyLines.map(({ key, text, tone, Icon }) => (
                    <span
                      key={key}
                      className={cn(
                        "inline-flex items-center gap-1 text-[11px]",
                        tone
                      )}
                    >
                      <Icon className="size-3" aria-hidden="true" />
                      {text}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <ArrowRight className="size-4 shrink-0 self-center text-muted-foreground/40 group-hover:text-primary transition-colors" />
          </Link>
          {/* Save heart on the card itself, so the garden empty state's
              "tap the heart icon on any herb card" instruction is true.
              It sits outside the Link so it is not nested interactivity. */}
          <button
            type="button"
            onClick={handleSave}
            aria-label={saved ? t("garden.remove") : t("garden.save")}
            aria-pressed={saved}
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full transition-colors",
              saved
                ? "bg-rose-500 text-white"
                : "text-muted-foreground hover:text-rose-500"
            )}
          >
            <Heart className={cn("size-4", saved && "fill-white")} />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
