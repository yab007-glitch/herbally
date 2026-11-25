"use client";

import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { MessageCircle, Calculator, Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { HerbImage } from "@/components/herbs/HerbImage";
import { EvidenceGrade } from "@/components/herbs/evidence-grade";
import { ProvenanceBadge } from "@/components/herbs/provenance-badge";
import {
  SafetyGlance,
  type GlanceInteraction,
} from "@/components/herbs/herb-safety-glance";
import {
  parseProvenance,
  isVerified,
  getReviewState,
} from "@/lib/types/provenance";
import { isBucketCategory } from "@/lib/herbs/category";
import { isDangerousHerb } from "@/lib/data/dangerous-herbs";
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
    description?: string;
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
  /** Whether the hero should link to the dose calculator (false for lethal/no-dose herbs). */
  showCalculator?: boolean;
}

export function HerbHeroV2({
  herb,
  provenance = null,
  pubmedSheetStatus = null,
  isManualMonograph,
  interactions = [],
  safetyHref = "#safety",
  showCalculator = true,
}: HerbHeroV2Props) {
  const dangerous = isDangerousHerb(herb.slug);
  const allowCalculator = showCalculator && !dangerous;
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
  // Keep pregnancy/nursing safety tied to the herb's own provenance check rather
  // than letting an unreviewed PubMed draft below veto primary-source warnings
  // (e.g., White Willow and Black Cohosh are primary_source verified unsafe).
  const verified = isVerified(parsedProvenance);
  const reviewState = getReviewState(parsedProvenance);
  // When the sheet vetoes a "Verified" claim, pass the adjusted method for the
  // provenance pill below.
  const badgeProvenance =
    sheetNotReviewed && verified
      ? { ...parsedProvenance, verification_method: "ai_summarized" as const }
      : parsedProvenance;
  // Asymmetric safety-first gating: dangerous herbs always show unsafe (`false`);
  // human-verified entries show their verified verdicts; `needs_re_review` keeps
  // explicit negative warnings (`false`) while withholding unverified `safe` (`true`).
  const pregnancySafe = dangerous
    ? false
    : verified
      ? herb.pregnancy_safe
      : reviewState?.kind === "needs_re_review" && herb.pregnancy_safe === false
        ? false
        : null;
  const nursingSafe = dangerous
    ? false
    : verified
      ? herb.nursing_safe
      : reviewState?.kind === "needs_re_review" && herb.nursing_safe === false
        ? false
        : null;
  const routeVerified = !dangerous && verified;
  const pregnancySafeOral = routeVerified
    ? (herb.pregnancy_safe_oral ?? null)
    : null;
  const pregnancySafeTopical = routeVerified
    ? (herb.pregnancy_safe_topical ?? null)
    : null;
  const nursingSafeOral = routeVerified
    ? (herb.nursing_safe_oral ?? null)
    : null;
  const nursingSafeTopical = routeVerified
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
              sizePx={96}
              loading="eager"
              fetchPriority="high"
              className="size-20 rounded-lg sm:size-24"
            />
            <button
              onClick={handleSave}
              className={cn(
                "absolute -right-2 -top-2 flex size-10 items-center justify-center rounded-full shadow-md ring-2 ring-card transition-transform hover:scale-110",
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
              {herb.herb_categories?.name &&
                !isBucketCategory(herb.herb_categories.name) && (
                  <Badge variant="secondary" className="text-xs">
                    {herb.herb_categories.name}
                  </Badge>
                )}
              {dangerous ? (
                <Badge variant="destructive" className="text-xs">
                  {t("safetyGlance.toxicPlantBadge")}
                </Badge>
              ) : (
                <EvidenceGrade
                  level={
                    herb.evidence_level &&
                    ["A", "B", "C", "D", "trad"].includes(herb.evidence_level)
                      ? (herb.evidence_level as "A" | "B" | "C" | "D" | "trad")
                      : "trad"
                  }
                />
              )}
            </div>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {herb.name}
            </h1>
            {/* Half the library is catalogued under its botanical name, so
                this line can repeat the H1 verbatim ("Abies nigra" / "Abies
                nigra"). Print it only when it adds something — same guard as
                the herb card. */}
            {herb.scientific_name?.trim().toLowerCase() !==
              herb.name.trim().toLowerCase() && (
              <p className="mt-1 text-sm italic text-muted-foreground">
                {herb.scientific_name}
              </p>
            )}
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
          isDangerous={dangerous}
        />

        <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
          <Link
            href={`/herbalist?herb=${herb.slug}`}
            // 2,198 ?herb= URLs were being crawled as duplicates of /herbalist.
            // The parameter is a client-side preselection, not a different page.
            rel="nofollow"
            className={cn(
              buttonVariants({ size: "sm" }),
              "min-h-10 rounded-full px-4"
            )}
          >
            <MessageCircle className="mr-1 size-3.5" aria-hidden="true" />
            {t("herbDetail.askHerbalist")}
          </Link>
          {/* Demoted on purpose and suppressed completely for lethal/no-dose
              plants: still a real button for dosable herbs, never rendered for
              poisons or entries without a quantitative dose. */}
          {allowCalculator && (
            <Link
              href={`/calculator?herb=${herb.slug}`}
              className={cn(
                buttonVariants({ size: "sm", variant: "outline" }),
                "min-h-10 rounded-full px-4"
              )}
            >
              <Calculator className="mr-1 size-3.5" aria-hidden="true" />
              {t("herbDetail.calculateDose")}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
