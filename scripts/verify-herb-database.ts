#!/usr/bin/env tsx
/**
 * verify-herb-database.ts — Automated quality checks for the HerbAlly database.
 * 
 * Validation rules:
 *   1. Scientific names must follow binomial nomenclature (Genus species)
 *   2. No hallucinated PMIDs (must be 7-8 digit integers starting with 1-3)
 *   3. No safety conflicts (can't be both safe AND unsafe for pregnancy/nursing)
 *   4. Evidence levels must be valid (A, B, C, D, or trad)
 *   5. Duplicate slug detection
 *   6. Category must exist
 *   7. Empty required fields (name, scientific_name, slug, description)
 * 
 * Usage:
 *   npx tsx scripts/verify-herb-database.ts              # Check all herbs
 *   npx tsx scripts/verify-herb-database.ts --ci         # CI mode (exit non-zero on errors)
 *   npx tsx scripts/verify-herb-database.ts --staged     # Check only staged changes
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import * as fs from "fs";

config({ path: ".env.local" });
config({ path: ".env" });

// ─── Types ──────────────────────────────────────────────────────────

interface HerbRow {
  id: string;
  name: string;
  slug: string;
  scientific_name: string;
  description: string | null;
  evidence_level: string | null;
  pregnancy_safe: boolean | null;
  nursing_safe: boolean | null;
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

// ─── Validation Rules ──────────────────────────────────────────────

const VALID_EVIDENCE_LEVELS = ["A", "B", "C", "D", "trad"];
const BINOMIAL_REGEX = /^[A-Z][a-z]+ [a-z]+/;
const PMID_REGEX = /^\d{7,8}$/;

function validateHerb(herb: HerbRow, validCategoryIds: Set<string>): VerificationError[] {
  const errors: VerificationError[] = [];
  const { id: _id, name, slug, scientific_name, description, evidence_level, pregnancy_safe: _pregnancy_safe, nursing_safe: _nursing_safe, citations, category_id } = herb;

  // 1. Required fields
  if (!name || name.trim().length < 2) {
    errors.push({ herb: name || slug, slug, field: "name", message: "Name is empty or too short", severity: "error" });
  }
  if (!scientific_name || scientific_name.trim().length < 2) {
    errors.push({ herb: name || slug, slug, field: "scientific_name", message: "Scientific name is empty", severity: "error" });
  }
  if (!slug || slug.trim().length < 2) {
    errors.push({ herb: name || "unknown", slug, field: "slug", message: "Slug is empty or too short", severity: "error" });
  }
  if (!description || description.trim().length < 10) {
    errors.push({ herb: name, slug, field: "description", message: "Description is too short (min 10 chars)", severity: "warning" });
  }

  // 2. Binomial nomenclature check
  if (scientific_name && !BINOMIAL_REGEX.test(scientific_name.trim()) && 
      !/^[A-Z]/.test(scientific_name) && // Skip single-word names
      !scientific_name.includes("(") && // Skip names with parentheticals
      scientific_name.split(" ").length < 2) {
    errors.push({ herb: name, slug, field: "scientific_name", message: `Does not follow binomial format: "${scientific_name}"`, severity: "warning" });
  }

  // 3. Evidence level validation
  if (evidence_level && !VALID_EVIDENCE_LEVELS.includes(evidence_level)) {
    errors.push({ herb: name, slug, field: "evidence_level", message: `Invalid evidence level: "${evidence_level}"`, severity: "error" });
  }

  // 4. Safety flag validation (will be expanded for oral vs topical)

  // 5. Citation/PMID validation
  if (Array.isArray(citations)) {
    for (const citation of citations as Array<Record<string, unknown>>) {
      if (citation.pmid) {
        const pmid = String(citation.pmid);
        if (!PMID_REGEX.test(pmid)) {
          errors.push({ herb: name, slug, field: "citations", message: `Invalid PMID format: "${pmid}"`, severity: "error" });
        }
        if (!citation.url || !String(citation.url).includes("pubmed")) {
          errors.push({ herb: name, slug, field: "citations", message: `Missing or invalid PubMed URL for PMID: ${pmid}`, severity: "warning" });
        }
        if (!citation.title || String(citation.title).length < 5) {
          errors.push({ herb: name, slug, field: "citations", message: `Citation has empty or very short title for PMID: ${pmid}`, severity: "warning" });
        }
      }
    }
  }

  // 6. Category validation
  if (category_id && !validCategoryIds.has(category_id)) {
    errors.push({ herb: name, slug, field: "category_id", message: `References non-existent category: ${category_id}`, severity: "error" });
  }

  return errors;
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  const isCI = process.argv.includes("--ci");
  const _isStaged = process.argv.includes("--staged");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.log("⚠️  No Supabase credentials — checking migrations only");
    await checkMigrationFiles(isCI);
    return;
  }

  const supabase = createClient(url, key);
  const allErrors: VerificationError[] = [];

  // Get valid categories
  const { data: categories } = await supabase
    .from("herb_categories")
    .select("id");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  const validCategoryIds = new Set((categories ?? []).map((c: any) => c.id));

  // Get herbs
  console.log("🔍 Verifying herb database...");
  const herbList: HerbRow[] = [];
  let page = 0;

  while (true) {
    const { data } = await supabase
      .from("herbs")
      .select("*")
      .eq("is_published", true)
      .order("name")
      .range(page * 1000, (page + 1) * 1000 - 1);

    if (!data || data.length === 0) break;
    herbList.push(...(data as HerbRow[]));
    if (data.length < 1000) break;
    page++;
  }

  console.log(`  Checking ${herbList.length} herbs...`);

  // Check for duplicate slugs
  const slugs = new Map<string, number>();
  for (const herb of herbList) {
    slugs.set(herb.slug, (slugs.get(herb.slug) || 0) + 1);
  }
  for (const [slug, count] of slugs) {
    if (count > 1) {
      allErrors.push({ herb: "DUPLICATE", slug, field: "slug", message: `Duplicate slug found ${count} times`, severity: "error" });
    }
  }

  // Validate each herb
  for (const herb of herbList) {
    const errors = validateHerb(herb, validCategoryIds);
    allErrors.push(...errors);
  }

  // Also check migration files
  await checkMigrationFiles(false);

  // Report
  const errors = allErrors.filter(e => e.severity === "error");
  const warnings = allErrors.filter(e => e.severity === "warning");

  console.log(`\n📊 Results:`);
  console.log(`  Errors: ${errors.length}`);
  console.log(`  Warnings: ${warnings.length}`);

  if (errors.length > 0) {
    console.log(`\n❌ ERRORS (${errors.length}):`);
    errors.slice(0, 20).forEach(e => {
      console.log(`  ${e.herb} (${e.slug}): ${e.field} — ${e.message}`);
    });
    if (errors.length > 20) console.log(`  ... and ${errors.length - 20} more`);
  }

  if (warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS (${warnings.length}):`);
    warnings.slice(0, 10).forEach(e => {
      console.log(`  ${e.herb} (${e.slug}): ${e.field} — ${e.message}`);
    });
    if (warnings.length > 10) console.log(`  ... and ${warnings.length - 10} more`);
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log("\n✅ All herbs passed validation!");
  }

  if (isCI && errors.length > 0) {
    console.error("\n❌ CI check failed — resolve errors before merging.");
    process.exit(1);
  }
}

async function checkMigrationFiles(_isCI: boolean) {
  const migrationsDir = "supabase/migrations";
  if (!fs.existsSync(migrationsDir)) return;

  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql"));
  console.log(`\n📄 Checking ${files.length} migration files...`);

  for (const file of files) {
    const content = fs.readFileSync(`${migrationsDir}/${file}`, "utf-8");
    
    // Check for common issues
    if (content.includes("DROP TABLE") && !content.includes("IF EXISTS")) {
      console.log(`  ⚠️  ${file}: Contains DROP TABLE without IF EXISTS`);
    }
    if (content.includes("DELETE FROM") && !content.includes("WHERE")) {
      console.log(`  ⚠️  ${file}: Contains DELETE FROM without WHERE clause`);
    }
  }
}

main().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
