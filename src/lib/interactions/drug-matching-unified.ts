import { matchesDrugInteraction } from "@/lib/utils/drug-match";
import {
  KNOWN_UNRESOLVED_PAIR_COLLISIONS,
  type KnownPairCollisionSpec,
} from "@/lib/db/verify-rules";

const FRENCH_CANONICAL_DRUG_ALIASES: Readonly<Record<string, string>> = {
  warfarine: "warfarin",
  aspirine: "aspirin",
  ibuprofene: "ibuprofen",
  paracetamol: "acetaminophen",
  acetaminophene: "acetaminophen",
  digoxine: "digoxin",
  metformine: "metformin",
  insuline: "insulin",
  ciclosporine: "cyclosporine",
  atorvastatine: "atorvastatin",
  simvastatine: "simvastatin",
  statine: "statin",
  statines: "statins",
  anticoagulant: "anticoagulants",
  anticoagulants: "anticoagulants",
  antidepresseur: "antidepressants",
  antidepresseurs: "antidepressants",
  anticonvulsivant: "anticonvulsants",
  anticonvulsivants: "anticonvulsants",
  immunosuppresseur: "immunosuppressants",
  immunosuppresseurs: "immunosuppressants",
  diuretique: "diuretics",
  diuretiques: "diuretics",
  contraceptif: "oral contraceptives",
  contraceptifs: "oral contraceptives",
  tamoxifene: "tamoxifen",
};

function foldFrenchDrugQuery(raw: string): string {
  const folded = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  return FRENCH_CANONICAL_DRUG_ALIASES[folded] ?? raw;
}

/**
 * Normalized alias resolution that strictly separates single ingredients
 * (e.g. metformin vs insulin) from therapeutic classes, and resolves French
 * generic/class aliases uniformly with English drug labels.
 */
export function matchDrugQueryUnified(
  userDrugQuery: string,
  interactionDrugName: string
): boolean {
  if (matchesDrugInteraction(userDrugQuery, interactionDrugName)) return true;
  const translated = foldFrenchDrugQuery(userDrugQuery);
  if (translated !== userDrugQuery) {
    return matchesDrugInteraction(translated, interactionDrugName);
  }
  return false;
}

/**
 * Find any unresolved legacy URL collisions affecting a herb slug,
 * preserving every colliding entry without choosing or ranking severity.
 */
export function findCollisionsForHerb(
  herbSlug: string
): KnownPairCollisionSpec[] {
  const normalizedSlug = herbSlug.trim().toLowerCase();
  if (!normalizedSlug) return [];
  const prefix = `/interactions/${normalizedSlug}/`;
  return KNOWN_UNRESOLVED_PAIR_COLLISIONS.filter((spec) =>
    spec.path.toLowerCase().startsWith(prefix)
  );
}

/**
 * Find any unresolved legacy URL collisions whose path or signature references
 * a given drug slug or label, without merging or mutating the colliding rows.
 */
export function findCollisionsForDrug(
  drugSlugOrName: string
): KnownPairCollisionSpec[] {
  const needle = drugSlugOrName.trim().toLowerCase();
  if (!needle) return [];
  return KNOWN_UNRESOLVED_PAIR_COLLISIONS.filter((spec) => {
    const [, , , drugSegment] = spec.path.toLowerCase().split("/");
    if (drugSegment && drugSegment.includes(needle)) return true;
    return spec.expectedSignatures.some((sig) =>
      sig.toLowerCase().includes(needle)
    );
  }).map((spec) => ({
    ...spec,
    herbSlug: spec.path.split("/")[2] ?? "",
  })) as Array<KnownPairCollisionSpec & { herbSlug: string }>;
}

/** Export herbSlug-enriched collision specs for downstream UI/API surfaces. */
export function getCollisionsWithSlugs(): Array<
  KnownPairCollisionSpec & { herbSlug: string; drugSlug: string }
> {
  return KNOWN_UNRESOLVED_PAIR_COLLISIONS.map((spec) => {
    const parts = spec.path.split("/");
    return {
      ...spec,
      herbSlug: parts[2] ?? "",
      drugSlug: parts[3] ?? "",
    };
  });
}
