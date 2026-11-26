import type { InteractionSeverity } from "@/lib/interactions/pairs";

/**
 * Culinary herbs commonly consumed both as ordinary foods/teas and in
 * concentrated supplements, where dose and preparation form strongly affect
 * interaction risk (e.g. ginger, turmeric, garlic, green tea).
 */
const CULINARY_VS_EXTRACT_HERBS = new Set([
  "ginger",
  "turmeric",
  "curcumin",
  "garlic",
  "green-tea",
  "cinnamon",
  "chamomile",
  "roman-chamomile",
  "licorice",
  "cranberry",
  "grapefruit",
  "cayenne",
  "black-pepper",
  "flaxseed",
  "fennel",
  "rosemary",
  "sage",
  "thyme",
  "oregano",
  "peppermint",
  "fenugreek",
]);

export function getInteractionPreparationContext(
  herbSlug: string,
  fr: boolean
): { shortLabel: string; detail: string } {
  const normalized = herbSlug.trim().toLowerCase();
  if (CULINARY_VS_EXTRACT_HERBS.has(normalized)) {
    return fr
      ? {
          shortLabel: "Alimentaire vs extrait concentré",
          detail:
            "Les quantités culinaires habituelles ne comportent pas le même niveau d'exposition que les gélules, extraits standardisés ou teintures concentrées. Précisez toujours la forme et la dose exactes à votre pharmacien.",
        }
      : {
          shortLabel: "Dietary amount vs. concentrated extract",
          detail:
            "Ordinary culinary amounts in food generally represent different exposure than high-dose capsules, standardized extracts, or concentrated tinctures. Always tell your pharmacist the exact preparation and daily amount you take.",
        };
  }
  return fr
    ? {
        shortLabel: "Dépend de la préparation et de la dose",
        detail:
          "Les préparations (tisane, poudre, teinture, extrait standardisé) et la teneur en composés actifs varient sensiblement d'un produit à l'autre.",
      }
    : {
        shortLabel: "Varies by preparation & extract strength",
        detail:
          "Active constituent levels vary substantially across herbal teas, whole-plant powders, tinctures, and concentrated extracts. Verify your exact product formulation with a pharmacist.",
      };
}

export type EvidenceBucket =
  | "human_clinical"
  | "limited_or_case"
  | "preclinical_or_theoretical"
  | "unclassified";

export function classifyEvidenceBucket(
  evidenceLevel: string | null | undefined
): EvidenceBucket {
  const norm = (evidenceLevel ?? "").trim().toLowerCase();
  if (norm === "well-documented") return "human_clinical";
  if (norm === "moderate-evidence") return "limited_or_case";
  if (
    norm === "limited-evidence" ||
    norm === "theoretical" ||
    norm === "theoretical_only"
  ) {
    return "preclinical_or_theoretical";
  }
  return "unclassified";
}

export function countEvidenceBuckets(
  items: ReadonlyArray<{ evidenceLevel?: string | null }>
): Record<EvidenceBucket, number> {
  const counts: Record<EvidenceBucket, number> = {
    human_clinical: 0,
    limited_or_case: 0,
    preclinical_or_theoretical: 0,
    unclassified: 0,
  };
  for (const item of items) {
    counts[classifyEvidenceBucket(item.evidenceLevel)] += 1;
  }
  return counts;
}

/**
 * Defense-in-depth sanitizer: if a legacy interaction row still carries a
 * stale "Grade lowered from moderate to mild." sentence while its severity is
 * severe/moderate/contraindicated, strip the contradictory clause so rendered
 * copy never contradicts the badge.
 */
export function sanitizeContradictoryEvidenceNote(
  note: string | null | undefined,
  severity: InteractionSeverity
): string | null {
  if (!note) return null;
  const trimmed = note.trim();
  if (!trimmed) return null;
  if (severity === "mild") return trimmed;
  const cleaned = trimmed
    .replace(/\s*Grade\s+lowered\s+from\s+[^.]+\.?/gi, "")
    .replace(/\s*(?:Note|Gravité|Niveau)\s+abaiss[^\n.]*\.?/gi, "")
    .trim();
  return cleaned || null;
}
