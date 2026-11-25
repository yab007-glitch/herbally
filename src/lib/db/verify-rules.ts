import type { PairUrlCollision } from "@/lib/interactions/pair-url";

export type SupabaseTargetKind =
  | "missing"
  | "invalid"
  | "placeholder"
  | "legacy-hosted"
  | "production"
  | "custom";

export function classifySupabaseTarget(
  url: string | undefined
): SupabaseTargetKind {
  const trimmed = (url ?? "").trim();
  if (!trimmed) return "missing";

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "invalid";
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "placeholder.supabase.co") return "placeholder";

  if (
    parsed.protocol === "https:" &&
    hostname === "api.herbally.app" &&
    parsed.port === "" &&
    (parsed.pathname === "" || parsed.pathname === "/") &&
    parsed.search === "" &&
    parsed.hash === "" &&
    !parsed.username &&
    !parsed.password
  ) {
    return "production";
  }

  if (hostname.endsWith(".supabase.co")) return "legacy-hosted";
  return "custom";
}

export interface CatalogCounts {
  categories: number;
  herbs: number;
  interactions: number;
}

export interface CatalogCardinalityError {
  field: "herb_categories" | "herbs" | "drug_interactions";
  message: string;
}

export const DEFAULT_MIN_CARDINALITY: CatalogCounts = {
  categories: 5,
  herbs: 100,
  interactions: 50,
};

export function checkCatalogCardinality(
  counts: CatalogCounts,
  mins: CatalogCounts = DEFAULT_MIN_CARDINALITY
): CatalogCardinalityError[] {
  const errors: CatalogCardinalityError[] = [];
  if (counts.categories < mins.categories) {
    errors.push({
      field: "herb_categories",
      message: `Catalog cardinality check failed: expected at least ${mins.categories} herb_categories, found ${counts.categories}`,
    });
  }
  if (counts.herbs < mins.herbs) {
    errors.push({
      field: "herbs",
      message: `Catalog cardinality check failed: expected at least ${mins.herbs} published herbs, found ${counts.herbs}`,
    });
  }
  if (counts.interactions < mins.interactions) {
    errors.push({
      field: "drug_interactions",
      message: `Catalog cardinality check failed: expected at least ${mins.interactions} published drug_interactions, found ${counts.interactions}`,
    });
  }
  return errors;
}

export interface KnownPairCollisionSpec {
  path: string;
  expectedRowCount: number;
  /** Exact `drugName|severity` change-detection fingerprints verified in audits (not clinical endorsement). */
  expectedSignatures: readonly string[];
  editorialBlocker: string;
}

/**
 * Narrow inventory of the 6 pre-existing unresolved `drug_interactions` URL
 * collisions documented in the 2026-11-24 audits while awaiting owner clinical
 * disambiguation. Protected fail-safe in APIs, pair pages (`noindex`), and
 * sitemap exclusion. Any new collision or any change to these entries fails CI.
 */
export const KNOWN_UNRESOLVED_PAIR_COLLISIONS: readonly KnownPairCollisionSpec[] =
  [
    {
      path: "/interactions/sage/anticonvulsants",
      expectedRowCount: 2,
      expectedSignatures: [
        "Anticonvulsants|moderate",
        "Anticonvulsants (Phenytoin, Valproate, Carbamazepine)|severe",
      ],
      editorialBlocker:
        "Owner clinical sign-off required to reconcile moderate vs severe anticonvulsant records.",
    },
    {
      path: "/interactions/rhodiola/antidepressants",
      expectedRowCount: 2,
      expectedSignatures: [
        "Antidepressants (SSRIs)|moderate",
        "Antidepressants (MAOIs, SSRIs, SNRIs)|moderate",
      ],
      editorialBlocker:
        "Owner clinical sign-off required to disambiguate colliding antidepressant rows.",
    },
    {
      path: "/interactions/astragalus/immunosuppressants",
      expectedRowCount: 2,
      expectedSignatures: [
        "Immunosuppressants|moderate",
        "Immunosuppressants (Cyclosporine, Tacrolimus, Prednisone)|severe",
      ],
      editorialBlocker:
        "Owner clinical sign-off required to disambiguate colliding immunosuppressant rows.",
    },
    {
      path: "/interactions/cats-claw/immunosuppressants",
      expectedRowCount: 2,
      expectedSignatures: [
        "Immunosuppressants|moderate",
        "Immunosuppressants (Cyclosporine, Tacrolimus)|severe",
      ],
      editorialBlocker:
        "Owner clinical sign-off required to disambiguate colliding immunosuppressant rows.",
    },
    {
      path: "/interactions/cordyceps/immunosuppressants",
      expectedRowCount: 2,
      expectedSignatures: [
        "Immunosuppressants|moderate",
        "Immunosuppressants (Cyclosporine, Prednisone)|moderate",
      ],
      editorialBlocker:
        "Owner clinical sign-off required to disambiguate colliding immunosuppressant rows.",
    },
    {
      path: "/interactions/evening-primrose/phenothiazines",
      expectedRowCount: 2,
      expectedSignatures: [
        "Phenothiazines (Chlorpromazine, Fluphenazine)|severe",
        "Phenothiazines (Chlorpromazine)|severe",
      ],
      editorialBlocker:
        "Owner clinical sign-off required to disambiguate colliding phenothiazine rows.",
    },
  ];

export function classifyPairUrlCollisions(
  collisions: PairUrlCollision[],
  knownInventory: readonly KnownPairCollisionSpec[] = KNOWN_UNRESOLVED_PAIR_COLLISIONS
): {
  blocking: PairUrlCollision[];
  knownFailSafe: Array<{
    collision: PairUrlCollision;
    spec: KnownPairCollisionSpec;
  }>;
  staleInventory: string[];
} {
  const byPath = new Map<string, KnownPairCollisionSpec>();
  for (const spec of knownInventory) {
    byPath.set(spec.path, spec);
  }

  const blocking: PairUrlCollision[] = [];
  const knownFailSafe: Array<{
    collision: PairUrlCollision;
    spec: KnownPairCollisionSpec;
  }> = [];
  const seenPaths = new Set<string>();

  for (const collision of collisions) {
    seenPaths.add(collision.path);
    const spec = byPath.get(collision.path);
    if (!spec) {
      blocking.push(collision);
      continue;
    }
    if (collision.rows.length !== spec.expectedRowCount) {
      blocking.push(collision);
      continue;
    }
    const actual = collision.rows
      .map((r) => `${r.drugName}|${r.severity ?? ""}`)
      .sort();
    const expected = [...spec.expectedSignatures].sort();
    if (
      actual.length !== expected.length ||
      actual.some((sig, idx) => sig !== expected[idx])
    ) {
      blocking.push(collision);
      continue;
    }
    knownFailSafe.push({ collision, spec });
  }

  const staleInventory = knownInventory
    .filter((spec) => !seenPaths.has(spec.path))
    .map((spec) => spec.path);

  return { blocking, knownFailSafe, staleInventory };
}

export interface SafetyConflictHerb {
  name: string;
  slug: string;
  pregnancy_safe: boolean | null;
  nursing_safe: boolean | null;
  contraindications?: string[] | null;
  dosage_adult?: string | null;
}

export interface SafetyConflict {
  herb: string;
  slug: string;
  field: "pregnancy_safe" | "nursing_safe";
  message: string;
}

const HARD_NO_SAFE_DOSE_RE =
  /\b(no safe dose|contraindicated in all forms|aucune dose s[uû]re)\b/i;
const PREGNANCY_CONTRA_RE =
  /\b(pregnancy|pregnant|abortifacient|grossesse|enceinte|abortif)\b/i;
const NURSING_CONTRA_RE =
  /\b(nursing|breastfeeding|lactation|allaitement|allaitante)\b/i;

export function checkSafetyConflicts(
  herb: SafetyConflictHerb
): SafetyConflict[] {
  const conflicts: SafetyConflict[] = [];
  const contraText = (herb.contraindications ?? []).join(" | ");
  const dosageText = herb.dosage_adult ?? "";

  if (herb.pregnancy_safe === true) {
    if (
      PREGNANCY_CONTRA_RE.test(contraText) ||
      HARD_NO_SAFE_DOSE_RE.test(dosageText)
    ) {
      conflicts.push({
        herb: herb.name,
        slug: herb.slug,
        field: "pregnancy_safe",
        message:
          "pregnancy_safe is true while contraindications or dosage state pregnancy/universal contraindication",
      });
    }
  }

  if (herb.nursing_safe === true) {
    if (
      NURSING_CONTRA_RE.test(contraText) ||
      HARD_NO_SAFE_DOSE_RE.test(dosageText)
    ) {
      conflicts.push({
        herb: herb.name,
        slug: herb.slug,
        field: "nursing_safe",
        message:
          "nursing_safe is true while contraindications or dosage state nursing/universal contraindication",
      });
    }
  }

  return conflicts;
}

export interface PublicationContractRow {
  id: string;
  drugName: string;
  isDrugClass?: boolean;
  singleIngredientRxcui?: string | null;
  publicationStatus?: string | null;
  clinicalReviewerId?: string | null;
  verifiedAt?: string | null;
  activeCitationCount?: number;
  retractedCitationCount?: number;
}

export interface PublicationContractIssue {
  id: string;
  code:
    | "CLASS_ROW_HAS_SINGLE_RXCUI"
    | "PUBLISHED_WITHOUT_REVIEW"
    | "PUBLISHED_WITHOUT_CITATION"
    | "PUBLISHED_WITH_RETRACTED_CITATION";
  message: string;
}

export function checkInteractionPublicationContract(
  rows: readonly PublicationContractRow[]
): PublicationContractIssue[] {
  const issues: PublicationContractIssue[] = [];
  for (const row of rows) {
    if (row.isDrugClass && row.singleIngredientRxcui) {
      issues.push({
        id: row.id,
        code: "CLASS_ROW_HAS_SINGLE_RXCUI",
        message: `${row.drugName}: drug-class row must not carry single-ingredient RxCUI (${row.singleIngredientRxcui})`,
      });
    }
    if (row.publicationStatus === "published") {
      if (!row.clinicalReviewerId || !row.verifiedAt) {
        issues.push({
          id: row.id,
          code: "PUBLISHED_WITHOUT_REVIEW",
          message: `${row.drugName}: published interaction row is missing clinical_reviewer_id or verified_at`,
        });
      }
      if ((row.activeCitationCount ?? 0) < 1) {
        issues.push({
          id: row.id,
          code: "PUBLISHED_WITHOUT_CITATION",
          message: `${row.drugName}: published interaction row has zero active claim-supporting citations`,
        });
      }
      if ((row.retractedCitationCount ?? 0) > 0) {
        issues.push({
          id: row.id,
          code: "PUBLISHED_WITH_RETRACTED_CITATION",
          message: `${row.drugName}: published interaction row still references ${row.retractedCitationCount} retracted citation(s)`,
        });
      }
    }
  }
  return issues;
}
