"use client";

import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { MessageCircle, Calculator, Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HerbImage } from "@/components/herbs/HerbImage";
import { EvidenceGrade } from "@/components/herbs/evidence-grade";
import { ProvenanceBadge } from "@/components/herbs/provenance-badge";
import {
  SafetyGlance,
  type GlanceInteraction,
} from "@/components/herbs/herb-safety-glance";
import { parseProvenance, isVerified } from "@/lib/types/provenance";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useSyncExternalStore, useEffect } from "react";
import {
  addToGarden,
  removeFromGarden,
  isInGarden,
  subscribeGarden,
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
    contraindications?: string[] | null;
  };
  provenance?: Record<string, unknown> | null;
  /** Status of the PubMed sheet rendered below the hero, if one is shown. */
  pubmedSheetStatus?: string | null;
  /** True when the page renders a hand-written monograph (tabbed view). */
  isManualMonograph?: boolean;
  /** Drug interactions, summarized in the safety panel above the CTA. */
  interactions?: GlanceInteraction[];
  /** Anchor that opens the full interaction list. */
  safetyHref?: string;
}

export function HerbHeroV2({
  herb,
  provenance = null,
  pubmedSheetStatus = null,
  isManualMonograph,
  interactions = [],
  safetyHref = "#safety",
}: HerbHeroV2Props) {
  const t = useTranslations();
  // Same external-store read as HerbCard: a lazy useState initializer ran
  // against localStorage during the first client render, which disagrees with
  // the server-rendered "not saved" markup (hydration mismatch). The server
  // snapshot keeps that false, and the client snapshot picks up the real value
  // without a second render.
  const saved = useSyncExternalStore(
    subscribeGarden,
    () => isInGarden(herb.slug),
    () => false
  );

  useEffect(() => {
    recordHerbExplored(herb.slug);
  }, [herb.slug]);

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

  const parsedProvenance = parseProvenance(provenance);
  // Cross-check against the PubMed sheet: a herb rendered with an
  // unreviewed sheet must not show "Verified" from the herb row alone, even
  // if its provenance record claims a review. Manual monographs render the
  // tabbed view, not the sheet, so the sheet cannot veto them.
  const sheetNotReviewed =
    isManualMonograph === false &&
    pubmedSheetStatus != null &&
    pubmedSheetStatus !== "reviewed";
  const verified = isVerified(parsedProvenance) && !sheetNotReviewed;
  // When the sheet vetoes a "Verified" claim, show the AI-summarized badge
  // instead so the hero agrees with the sheet's own "not yet human-reviewed"
  // label below it.
  const badgeProvenance =
    sheetNotReviewed && isVerified(parsedProvenance)
      ? { ...parsedProvenance, verification_method: "ai_summarized" as const }
      : parsedProvenance;
  // AI-generated pregnancy/nursing flags are not authoritative — only show a
  // safe/unsafe verdict when the monograph has been human-reviewed against a
  // primary source (manual / primary_source). Otherwise the safety panel says
  // "Unknown — not enough data", so a fabricated AI boolean can never read as
  // advice.
  const pregnancySafe = verified ? herb.pregnancy_safe : null;
  const nursingSafe = verified ? herb.nursing_safe : null;
  // Route of administration matters: an essential oil can be unsafe to swallow
  // and fine on the skin. Dropping these four flags lost that distinction, so
  // they are passed through to the safety panel.
  const pregnancySafeOral = verified
    ? (herb.pregnancy_safe_oral ?? null)
    : null;
  const pregnancySafeTopical = verified
    ? (herb.pregnancy_safe_topical ?? null)
    : null;
  const nursingSafeOral = verified ? (herb.nursing_safe_oral ?? null) : null;
  const nursingSafeTopical = verified
    ? (herb.nursing_safe_topical ?? null)
    : null;

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card">
      <div className="relative flex flex-col gap-5 p-5 sm:gap-6 sm:p-6">
        {/* Identity block: monogram, chips, title. The safety panel below is
            full width on purpose — it is the point of the card. */}
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:gap-5 sm:text-left">
          <div className="relative shrink-0">
            <HerbImage
              name={herb.name}
              imageUrl={herb.image_url}
              className="size-20 rounded-lg sm:size-24"
            />
            <button
              onClick={handleSave}
              className={cn(
                "absolute -right-2 -top-2 flex size-8 items-center justify-center rounded-full shadow-md ring-2 ring-card transition-transform hover:scale-110",
                saved
                  ? "bg-rose-500 text-white"
                  : "bg-background text-muted-foreground hover:text-rose-500"
              )}
              aria-label={saved ? t("garden.remove") : t("garden.save")}
              aria-pressed={saved}
            >
              <Heart className={cn("size-4", saved && "fill-white")} />
            </button>
          </div>

          <div className="min-w-0 flex-1">
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
            </div>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {herb.name}
            </h1>
            <p className="mt-1 text-sm italic text-muted-foreground">
              {herb.scientific_name}
            </p>
            {/* Provenance sits on its own line, below the name.
                It used to share a row with the evidence grade, which put a
                green "Evidence A · Multiple RCTs" pill next to an amber "Not
                human-reviewed" one — two opposite signals read as one
                contradiction. Here one row answers "how good is the
                evidence", the next answers "who checked it". */}
            <div className="mt-2 flex justify-center sm:justify-start">
              <ProvenanceBadge provenance={badgeProvenance} />
            </div>
          </div>
        </div>

        {/* One efficacy signal only: the category badge above already says
            what this herb is for. The old "Anti-inflammatory remedy" chip
            repeated it a second time and diluted the evidence chip. */}
        <SafetyGlance
          pregnancySafe={pregnancySafe}
          nursingSafe={nursingSafe}
          pregnancySafeOral={pregnancySafeOral}
          pregnancySafeTopical={pregnancySafeTopical}
          nursingSafeOral={nursingSafeOral}
          nursingSafeTopical={nursingSafeTopical}
          contraindications={herb.contraindications}
          interactions={interactions}
          href={safetyHref}
        />

        <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
          <Button
            size="sm"
            render={
              <Link
                href={`/herbalist?herb=${herb.slug}`}
                // 2,198 ?herb= URLs were being crawled as duplicates of /herbalist.
                // The parameter is a client-side preselection, not a different page.
                rel="nofollow"
              />
            }
            className="rounded-full"
          >
            <MessageCircle className="mr-1 size-3" aria-hidden="true" />
            {t("herbDetail.askHerbalist")}
          </Button>
          {/* Demoted on purpose: still a real button, but it now comes after
              the safety summary instead of being the first thing offered. */}
          <Button
            size="sm"
            variant="outline"
            render={<Link href={`/calculator?herb=${herb.slug}`} />}
            className="rounded-full"
          >
            <Calculator className="mr-1 size-3" aria-hidden="true" />
            {t("herbDetail.calculateDose")}
          </Button>
        </div>
      </div>
    </div>
  );
}
