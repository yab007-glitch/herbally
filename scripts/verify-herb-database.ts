#!/usr/bin/env tsx
/**
 * verify-herb-database.ts — Automated quality checks for the HerbAlly database.
 *
 * Usage:
 *   npx tsx scripts/verify-herb-database.ts                   # Check all herbs + interactions
 *   npx tsx scripts/verify-herb-database.ts --ci              # CI mode (fails if DB creds missing/placeholder or errors found)
 *   npx tsx scripts/verify-herb-database.ts --production-only # Reject legacy hosted supabase.co targets
 *   npx tsx scripts/verify-herb-database.ts --migrations-only # Static check of supabase/migrations/*.sql only
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import * as fs from "fs";
import {
  checkCatalogCardinality,
  checkInteractionPublicationContract,
  checkSafetyConflicts,
  classifyPairUrlCollisions,
  classifySupabaseTarget,
} from "../src/lib/db/verify-rules";
import { findPairUrlCollisions } from "../src/lib/interactions/pair-url";

config({ path: ".env.local" });
config({ path: ".env" });

/**
 * Post-00104 the public read path is public.herbs_public. Select only the
 * columns the validators inspect: pulling PUBLIC_HERB_COLUMNS would force the
 * redacted translations and other expensive functions over every 1,000-row
 * batch and trip PostgREST's statement timeout.
 */
const VERIFY_HERB_COLUMNS =
  "id,name,slug,scientific_name,description,evidence_level,citations,category_id,contraindications,dosage_adult,pregnancy_safe,nursing_safe";

interface HerbRow {
  id: string;
  name: string;
  slug: string;
  scientific_name: string;
  description: string | null;
  evidence_level: string | null;
  pregnancy_safe: boolean | null;
  nursing_safe: boolean | null;
  contraindications: string[] | null;
  dosage_adult: string | null;
  citations: unknown;
  category_id: string | null;
  is_published: boolean;
}

interface VerificationError {
  herb: string;
  slug: string;
  field: string;
  message: string;
  severity: "error" | "warning";
}

const VALID_EVIDENCE_LEVELS = ["A", "B", "C", "D", "trad"];
const BINOMIAL_REGEX = /^[A-Z][a-z]+ [a-z]+/;
const PMID_REGEX = /^\d{4,8}$/;

function validateHerb(
  herb: HerbRow,
  validCategoryIds: Set<string>
): VerificationError[] {
  const errors: VerificationError[] = [];
  const {
    name,
    slug,
    scientific_name,
    description,
    evidence_level,
    citations,
    category_id,
  } = herb;

  if (!name || name.trim().length < 2) {
    errors.push({
      herb: name || slug,
      slug,
      field: "name",
      message: "Name is empty or too short",
      severity: "error",
    });
  }
  if (!scientific_name || scientific_name.trim().length < 2) {
    errors.push({
      herb: name || slug,
      slug,
      field: "scientific_name",
      message: "Scientific name is empty",
      severity: "error",
    });
  }
  if (!slug || slug.trim().length < 2) {
    errors.push({
      herb: name || "unknown",
      slug,
      field: "slug",
      message: "Slug is empty or too short",
      severity: "error",
    });
  }
  if (!description || description.trim().length < 10) {
    errors.push({
      herb: name,
      slug,
      field: "description",
      message: "Description is too short (min 10 chars)",
      severity: "warning",
    });
  }

  if (
    scientific_name &&
    !BINOMIAL_REGEX.test(scientific_name.trim()) &&
    !/^[A-Z]/.test(scientific_name) &&
    !scientific_name.includes("(") &&
    scientific_name.split(" ").length < 2
  ) {
    errors.push({
      herb: name,
      slug,
      field: "scientific_name",
      message: `Does not follow binomial format: "${scientific_name}"`,
      severity: "warning",
    });
  }

  if (evidence_level && !VALID_EVIDENCE_LEVELS.includes(evidence_level)) {
    errors.push({
      herb: name,
      slug,
      field: "evidence_level",
      message: `Invalid evidence level: "${evidence_level}"`,
      severity: "error",
    });
  }

  for (const conflict of checkSafetyConflicts(herb)) {
    errors.push({
      herb: conflict.herb,
      slug: conflict.slug,
      field: conflict.field,
      message: conflict.message,
      severity: "error",
    });
  }

  if (Array.isArray(citations)) {
    for (const citation of citations as Array<Record<string, unknown>>) {
      if (citation.pmid) {
        const pmid = String(citation.pmid);
        if (!PMID_REGEX.test(pmid)) {
          errors.push({
            herb: name,
            slug,
            field: "citations",
            message: `Invalid PMID format: "${pmid}"`,
            severity: "error",
          });
        }
        if (!citation.url || !String(citation.url).includes("pubmed")) {
          errors.push({
            herb: name,
            slug,
            field: "citations",
            message: `Missing or invalid PubMed URL for PMID: ${pmid}`,
            severity: "warning",
          });
        }
        if (!citation.title || String(citation.title).length < 5) {
          errors.push({
            herb: name,
            slug,
            field: "citations",
            message: `Citation has empty or very short title for PMID: ${pmid}`,
            severity: "warning",
          });
        }
      }
    }
  }

  if (category_id && !validCategoryIds.has(category_id)) {
    errors.push({
      herb: name,
      slug,
      field: "category_id",
      message: `References non-existent category: ${category_id}`,
      severity: "error",
    });
  }

  return errors;
}

async function main() {
  const isCI = process.argv.includes("--ci");
  const productionOnly = process.argv.includes("--production-only");
  const migrationsOnly = process.argv.includes("--migrations-only");
  const strictCollisions = process.argv.includes("--strict-collisions");

  if (migrationsOnly) {
    await checkMigrationFiles();
    return;
  }

  const url =
    process.env.VERIFY_DB_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.VERIFY_DB_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const target = classifySupabaseTarget(url);

  if (
    !url ||
    !key ||
    target === "missing" ||
    target === "invalid" ||
    target === "placeholder"
  ) {
    console.error(
      `❌ Live database credentials are missing, invalid, or placeholder (target=${target}). Pass --migrations-only for static migration checks, or configure VERIFY_DB_SUPABASE_URL / VERIFY_DB_SUPABASE_ANON_KEY.`
    );
    if (isCI || productionOnly) process.exit(1);
    await checkMigrationFiles();
    return;
  }

  console.log(`🔍 Verifying herb database [target=${target}]...`);
  if (target !== "production") {
    console.warn(
      `⚠️  Target is not the exact HTTPS production origin https://api.herbally.app (target=${target}).`
    );
    if (productionOnly) {
      console.error(
        `❌ --production-only requires exact https://api.herbally.app origin (got target=${target}).`
      );
      process.exit(1);
    }
  }

  const supabase = createClient(url, key);
  const allErrors: VerificationError[] = [];

  const { data: categories, error: catError } = await supabase
    .from("herb_categories")
    .select("id");
  if (catError) {
    console.error(`❌ Failed to query herb_categories: ${catError.message}`);
    process.exit(1);
  }
  const validCategoryIds = new Set(
    (categories ?? []).map((c: { id: string }) => c.id)
  );

  const herbList: HerbRow[] = [];
  let lastSlug: string | null = null;

  while (true) {
    // Post-00104, anon has no table-wide SELECT on public.herbs; the sanitized
    // view is the only public read path. Keyset pagination on the unique slug:
    // OFFSET makes the view compute its sanitising functions for every skipped
    // row and trips the 3s anon statement timeout near the end of the library.
    let query = supabase
      .from("herbs_public" as never)
      .select(VERIFY_HERB_COLUMNS)
      .eq("is_published", true)
      .order("slug")
      .limit(1000);
    if (lastSlug) query = query.gt("slug", lastSlug);

    const { data, error } = await query;

    if (error) {
      console.error(`❌ Failed to query herbs: ${error.message}`);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    herbList.push(...(data as unknown as HerbRow[]));
    if (data.length < 1000) break;
    lastSlug = String((data[data.length - 1] as unknown as HerbRow).slug);
  }

  console.log(`  Checking ${herbList.length} published herbs...`);

  const slugs = new Map<string, number>();
  for (const herb of herbList) {
    slugs.set(herb.slug, (slugs.get(herb.slug) || 0) + 1);
  }
  for (const [slug, count] of slugs) {
    if (count > 1) {
      allErrors.push({
        herb: "DUPLICATE",
        slug,
        field: "slug",
        message: `Duplicate slug found ${count} times`,
        severity: "error",
      });
    }
  }

  for (const herb of herbList) {
    allErrors.push(...validateHerb(herb, validCategoryIds));
  }

  // Check drug_interactions URL collisions across published herbs (paginated),
  // reading 00101 governance columns when present with pre-migration fallback.
  const interactionRows: Array<{
    id: unknown;
    drug_name: unknown;
    severity: unknown;
    is_drug_class?: unknown;
    single_ingredient_rxcui?: unknown;
    publication_status?: unknown;
    clinical_reviewer_id?: unknown;
    verified_at?: unknown;
    herbs: unknown;
  }> = [];
  let ixPage = 0;
  let hasGovernanceCols = true;
  while (true) {
    const selectStr = hasGovernanceCols
      ? "id,drug_name,severity,is_drug_class,single_ingredient_rxcui,publication_status,clinical_reviewer_id,verified_at,herbs!inner(slug,is_published)"
      : "id,drug_name,severity,herbs!inner(slug,is_published)";
    const { data: ixBatch, error: ixError } = await supabase
      .from("drug_interactions")
      .select(selectStr)
      .eq("herbs.is_published", true)
      .order("id", { ascending: true })
      .range(ixPage * 1000, (ixPage + 1) * 1000 - 1);

    if (ixError) {
      if (
        hasGovernanceCols &&
        /column|does not exist|schema cache/i.test(ixError.message)
      ) {
        hasGovernanceCols = false;
        continue;
      }
      console.error(`❌ Failed to query drug_interactions: ${ixError.message}`);
      process.exit(1);
    }
    if (!ixBatch || ixBatch.length === 0) break;
    interactionRows.push(...(ixBatch as unknown as typeof interactionRows));
    if (ixBatch.length < 1000) break;
    ixPage++;
  }

  const pairCandidates = interactionRows
    .map((row) => {
      const herb = Array.isArray(row.herbs) ? row.herbs[0] : row.herbs;
      return {
        id: String(row.id),
        herbSlug: String((herb as { slug?: string } | null)?.slug ?? ""),
        drugName: String(row.drug_name),
        severity: String(row.severity),
      };
    })
    .filter((r) => Boolean(r.herbSlug));

  if (hasGovernanceCols) {
    const activeCountByInteraction = new Map<string, number>();
    const retractedCountByInteraction = new Map<string, number>();
    let citPage = 0;
    let hasCitationsTable = true;
    while (hasCitationsTable) {
      const { data: citBatch, error: citError } = await supabase
        .from("drug_interaction_citations" as never)
        .select(
          "interaction_id,retraction_status,url,source_licence,claim_support_anchor"
        )
        .order("id", { ascending: true })
        .range(citPage * 1000, (citPage + 1) * 1000 - 1);

      if (citError) {
        if (
          /does not exist|schema cache|42P01|PGRST205/i.test(citError.message)
        ) {
          hasCitationsTable = false;
          break;
        }
        console.error(
          `❌ Failed to query drug_interaction_citations: ${citError.message}`
        );
        process.exit(1);
      }
      const rows = (citBatch ?? []) as Array<{
        interaction_id?: string | null;
        retraction_status?: string | null;
        url?: string | null;
        source_licence?: string | null;
        claim_support_anchor?: string | null;
      }>;
      if (rows.length === 0) break;
      for (const c of rows) {
        if (!c.interaction_id) continue;
        if (c.retraction_status === "retracted") {
          retractedCountByInteraction.set(
            c.interaction_id,
            (retractedCountByInteraction.get(c.interaction_id) ?? 0) + 1
          );
        } else if (
          c.retraction_status === "active" &&
          Boolean(c.url?.trim()) &&
          Boolean(c.source_licence?.trim()) &&
          Boolean(c.claim_support_anchor?.trim())
        ) {
          activeCountByInteraction.set(
            c.interaction_id,
            (activeCountByInteraction.get(c.interaction_id) ?? 0) + 1
          );
        }
      }
      if (rows.length < 1000) break;
      citPage++;
    }

    for (const issue of checkInteractionPublicationContract(
      interactionRows.map((row) => {
        const id = String(row.id);
        return {
          id,
          drugName: String(row.drug_name),
          isDrugClass: Boolean(row.is_drug_class),
          singleIngredientRxcui:
            typeof row.single_ingredient_rxcui === "string"
              ? row.single_ingredient_rxcui
              : null,
          publicationStatus:
            typeof row.publication_status === "string"
              ? row.publication_status
              : null,
          clinicalReviewerId:
            typeof row.clinical_reviewer_id === "string"
              ? row.clinical_reviewer_id
              : null,
          verifiedAt:
            typeof row.verified_at === "string" ? row.verified_at : null,
          activeCitationCount: hasCitationsTable
            ? (activeCountByInteraction.get(id) ?? 0)
            : 0,
          retractedCitationCount: hasCitationsTable
            ? (retractedCountByInteraction.get(id) ?? 0)
            : 0,
        };
      })
    )) {
      allErrors.push({
        herb: "INTERACTION_CONTRACT",
        slug: issue.id,
        field: issue.code,
        message: issue.message,
        severity: "error",
      });
    }
  }

  for (const cardErr of checkCatalogCardinality({
    categories: validCategoryIds.size,
    herbs: herbList.length,
    interactions: pairCandidates.length,
  })) {
    allErrors.push({
      herb: "CATALOG",
      slug: cardErr.field,
      field: cardErr.field,
      message: cardErr.message,
      severity: "error",
    });
  }

  const collisions = findPairUrlCollisions(pairCandidates);
  if (strictCollisions) {
    for (const col of collisions) {
      allErrors.push({
        herb: col.herbSlug,
        slug: col.drugSlug,
        field: "drug_interactions.pair_url",
        message: `Unresolved URL collision at ${col.path} (${col.rows.length} rows, severityConflict=${col.hasSeverityConflict}): ${col.rows.map((r) => `${r.drugName} [${r.severity}]`).join(" vs ")}`,
        severity: "error",
      });
    }
  } else {
    const { blocking, knownFailSafe, staleInventory } =
      classifyPairUrlCollisions(collisions);
    for (const col of blocking) {
      allErrors.push({
        herb: col.herbSlug,
        slug: col.drugSlug,
        field: "drug_interactions.pair_url",
        message: `New or changed URL collision at ${col.path} (${col.rows.length} rows, severityConflict=${col.hasSeverityConflict}): ${col.rows.map((r) => `${r.drugName} [${r.severity}]`).join(" vs ")}`,
        severity: "error",
      });
    }
    for (const { collision, spec } of knownFailSafe) {
      allErrors.push({
        herb: collision.herbSlug,
        slug: collision.drugSlug,
        field: "drug_interactions.pair_url",
        message: `Known fail-safe collision at ${collision.path} (${collision.rows.length} rows; API/page fail-safe & excluded from sitemap). Editorial blocker: ${spec.editorialBlocker}`,
        severity: "warning",
      });
    }
    for (const stalePath of staleInventory) {
      allErrors.push({
        herb: "INVENTORY",
        slug: stalePath,
        field: "drug_interactions.pair_url",
        message: `Known collision ${stalePath} no longer collides in DB — prune from KNOWN_UNRESOLVED_PAIR_COLLISIONS`,
        severity: "warning",
      });
    }
  }

  await checkMigrationFiles();

  const errors = allErrors.filter((e) => e.severity === "error");
  const warnings = allErrors.filter((e) => e.severity === "warning");

  console.log(`\n📊 Results:`);
  console.log(`  Errors: ${errors.length}`);
  console.log(`  Warnings: ${warnings.length}`);

  if (errors.length > 0) {
    console.log(`\n❌ ERRORS (${errors.length}):`);
    errors.slice(0, 20).forEach((e) => {
      console.log(`  ${e.herb} (${e.slug}): ${e.field} — ${e.message}`);
    });
    if (errors.length > 20) console.log(`  ... and ${errors.length - 20} more`);
  }

  if (warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS (${warnings.length}):`);
    warnings.slice(0, 10).forEach((e) => {
      console.log(`  ${e.herb} (${e.slug}): ${e.field} — ${e.message}`);
    });
    if (warnings.length > 10)
      console.log(`  ... and ${warnings.length - 10} more`);
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log("\n✅ All herbs and interaction pair URLs passed validation!");
  }

  if (isCI && errors.length > 0) {
    console.error("\n❌ CI check failed — resolve errors before merging.");
    process.exit(1);
  }
}

async function checkMigrationFiles() {
  const migrationsDir = "supabase/migrations";
  if (!fs.existsSync(migrationsDir)) return;

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  console.log(
    `\n📄 Static lint of ${files.length} migration files (not execution proof — disposable Postgres integration runs in CI)...`
  );

  const requiredPending = [
    "00097_admin_aal2_rls.sql",
    "00098_newsletter_confirmation_sent_at.sql",
    "00099_newsletter_send_lease.sql",
    "00099b_formula_type_adult_reference_enum.sql",
    "00100_pediatric_containment_dosage_calculations.sql",
    "00101_interaction_publication_contract.sql",
    "00102_scientific_governance_and_incidents.sql",
    "00103_privacy_minimization_controls.sql",
    "00104_pediatric_boundary_contract.sql",
    "00105_clinical_edit_requests.sql",
    "00106_interaction_evidence_note_reconciliation.sql",
    "00107_open_herb_edit_suggestions.sql",
    "00108_perioperative_and_toxic_safety_reconciliation.sql",
    "00109_interaction_source_url_reconciliation.sql",
    "00110_ema_sennae_fructus_url_fix.sql",
    "00111_doac_and_antiplatelet_interactions.sql",
  ];
  for (const req of requiredPending) {
    if (!files.includes(req)) {
      console.error(`❌ Missing required pending migration: ${req}`);
      process.exit(1);
    }
  }

  for (const file of files) {
    const content = fs.readFileSync(`${migrationsDir}/${file}`, "utf-8");
    if (content.includes("DROP TABLE") && !content.includes("IF EXISTS")) {
      console.log(`  ⚠️  ${file}: Contains DROP TABLE without IF EXISTS`);
    }
    if (content.includes("DELETE FROM") && !content.includes("WHERE")) {
      console.log(`  ⚠️  ${file}: Contains DELETE FROM without WHERE clause`);
    }
    if (
      /^00(097|098|099|099b|100|101|102|103|104|105|106|107|108|109|110|111)/.test(
        file
      )
    ) {
      const noComments = content
        .replace(/--[^\n]*/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      if (/\(\?<[=!]/.test(noComments)) {
        console.error(
          `❌ ${file}: Contains PostgreSQL-16-incompatible regex lookbehind (?<= / (?<!`
        );
        process.exit(1);
      }
      const stripped = noComments.replace(
        /\$([a-zA-Z_0-9]*)\$[\s\S]*?\$\1\$/g,
        ""
      );
      const begins = (
        stripped.match(/^\s*(?:BEGIN|START\s+TRANSACTION)\s*;/gim) ?? []
      ).length;
      const commits = (
        stripped.match(/^\s*(?:COMMIT|END\s+TRANSACTION)\s*;/gim) ?? []
      ).length;
      if (begins !== commits) {
        console.error(
          `❌ ${file}: Unbalanced top-level BEGIN (${begins}) vs COMMIT (${commits})`
        );
        process.exit(1);
      }
    }
  }
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
