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
  checkSafetyConflicts,
  classifyPairUrlCollisions,
  classifySupabaseTarget,
} from "../src/lib/db/verify-rules";
import { findPairUrlCollisions } from "../src/lib/interactions/pair-url";

config({ path: ".env.local" });
config({ path: ".env" });

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
  let page = 0;

  while (true) {
    const { data, error } = await supabase
      .from("herbs")
      .select("*")
      .eq("is_published", true)
      .order("name")
      .range(page * 1000, (page + 1) * 1000 - 1);

    if (error) {
      console.error(`❌ Failed to query herbs: ${error.message}`);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    herbList.push(...(data as HerbRow[]));
    if (data.length < 1000) break;
    page++;
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

  // Check drug_interactions URL collisions across published herbs (paginated)
  const interactionRows: Array<{
    id: unknown;
    drug_name: unknown;
    severity: unknown;
    herbs: unknown;
  }> = [];
  let ixPage = 0;
  while (true) {
    const { data: ixBatch, error: ixError } = await supabase
      .from("drug_interactions")
      .select("id,drug_name,severity,herbs!inner(slug,is_published)")
      .eq("herbs.is_published", true)
      .order("id", { ascending: true })
      .range(ixPage * 1000, (ixPage + 1) * 1000 - 1);

    if (ixError) {
      console.error(`❌ Failed to query drug_interactions: ${ixError.message}`);
      process.exit(1);
    }
    if (!ixBatch || ixBatch.length === 0) break;
    interactionRows.push(...ixBatch);
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

  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
  console.log(`\n📄 Checking ${files.length} migration files...`);

  for (const file of files) {
    const content = fs.readFileSync(`${migrationsDir}/${file}`, "utf-8");
    if (content.includes("DROP TABLE") && !content.includes("IF EXISTS")) {
      console.log(`  ⚠️  ${file}: Contains DROP TABLE without IF EXISTS`);
    }
    if (content.includes("DELETE FROM") && !content.includes("WHERE")) {
      console.log(`  ⚠️  ${file}: Contains DELETE FROM without WHERE clause`);
    }
  }
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
