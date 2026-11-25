/**
 * Offline & Read-Only Content Quality Baseline Calculator.
 *
 * Counts empty safety fields, unverified provenance, uncited interaction pairs,
 * and unresolved URL collisions without modifying or deleting any database row.
 *
 * Usage:
 *   npx tsx scripts/content-quality-baseline.ts --fixture path/to/snapshot.json
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { KNOWN_UNRESOLVED_PAIR_COLLISIONS } from "../src/lib/db/verify-rules";

export interface BaselineHerbRow {
  slug: string;
  contraindications?: string[] | null;
  side_effects?: string[] | null;
  provenance?: { verification_method?: string | null } | null;
  reviewed_by?: string | null;
}

export interface BaselineInteractionRow {
  id: string;
  herb_slug: string;
  drug_name: string;
  source_url?: string | null;
  clinical_reviewer_id?: string | null;
}

export interface QualityBaselineSnapshot {
  generatedAt: string;
  herbs: BaselineHerbRow[];
  interactions: BaselineInteractionRow[];
}

export interface QualityBaselineReport {
  generatedAt: string;
  totalHerbs: number;
  herbsMissingContraindications: number;
  herbsMissingSideEffects: number;
  herbsUnverifiedProvenance: number;
  herbsWithoutReviewer: number;
  totalInteractions: number;
  interactionsMissingPrimaryUrl: number;
  interactionsWithoutClinicalReviewer: number;
  knownUnresolvedCollisions: number;
}

export function computeQualityBaseline(
  snapshot: QualityBaselineSnapshot
): QualityBaselineReport {
  let herbsMissingContraindications = 0;
  let herbsMissingSideEffects = 0;
  let herbsUnverifiedProvenance = 0;
  let herbsWithoutReviewer = 0;

  for (const h of snapshot.herbs) {
    if (!h.contraindications || h.contraindications.length === 0) {
      herbsMissingContraindications += 1;
    }
    if (!h.side_effects || h.side_effects.length === 0) {
      herbsMissingSideEffects += 1;
    }
    const method = h.provenance?.verification_method;
    if (method !== "manual" && method !== "primary_source") {
      herbsUnverifiedProvenance += 1;
    }
    if (!h.reviewed_by?.trim()) {
      herbsWithoutReviewer += 1;
    }
  }

  let interactionsMissingPrimaryUrl = 0;
  let interactionsWithoutClinicalReviewer = 0;

  for (const ix of snapshot.interactions) {
    if (!ix.source_url?.trim()) {
      interactionsMissingPrimaryUrl += 1;
    }
    if (!ix.clinical_reviewer_id?.trim()) {
      interactionsWithoutClinicalReviewer += 1;
    }
  }

  return {
    generatedAt: snapshot.generatedAt,
    totalHerbs: snapshot.herbs.length,
    herbsMissingContraindications,
    herbsMissingSideEffects,
    herbsUnverifiedProvenance,
    herbsWithoutReviewer,
    totalInteractions: snapshot.interactions.length,
    interactionsMissingPrimaryUrl,
    interactionsWithoutClinicalReviewer,
    knownUnresolvedCollisions: KNOWN_UNRESOLVED_PAIR_COLLISIONS.length,
  };
}

function runCli(): number {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--fixture");
  if (idx === -1 || !args[idx + 1]) {
    console.error(
      "Usage: npx tsx scripts/content-quality-baseline.ts --fixture <snapshot.json>"
    );
    return 1;
  }
  const raw = readFileSync(args[idx + 1], "utf8");
  const snapshot = JSON.parse(raw) as QualityBaselineSnapshot;
  const report = computeQualityBaseline(snapshot);
  console.log(JSON.stringify(report, null, 2));
  return 0;
}

if (
  process.argv[1] &&
  pathMatches(process.argv[1], fileURLToPath(import.meta.url))
) {
  process.exit(runCli());
}

function pathMatches(a: string, b: string): boolean {
  return a === b || a.endsWith("/scripts/content-quality-baseline.ts");
}
