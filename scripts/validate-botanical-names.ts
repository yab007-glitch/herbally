#!/usr/bin/env tsx
/**
 * validate-botanical-names.ts — Validates scientific plant names against
 * Plants of the World Online (POWO) API from Kew Gardens.
 * 
 * POWO is the authoritative source for plant taxonomy, maintained by
 * the Royal Botanic Gardens, Kew. It provides accepted names, synonyms,
 * family classification, and distribution data.
 * 
 * Usage:
 *   npx tsx scripts/validate-botanical-names.ts              # Validate all herbs
 *   npx tsx scripts/validate-botanical-names.ts --fix        # Auto-fix misspellings
 *   npx tsx scripts/validate-botanical-names.ts --sample 50  # Validate sample
 *   npx tsx scripts/validate-botanical-names.ts --dry-run   # Check only, no updates
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

// ─── POWO API Client ───────────────────────────────────────────────

const POWO_BASE = "https://powo.science.kew.org/api/2";

interface POWOResult {
  accepted: boolean;
  name: string;
  full_name_without_family_and_authors: string;
  family: string;
  rank: string;
  synonym: boolean;
  acceptedName?: string;
  authors?: string;
}

/**
 * Search POWO for a plant name and return the best match.
 * Rate limit: ~30 requests/minute for unauthenticated access.
 */
async function searchPOWO(scientificName: string): Promise<POWOResult | null> {
  try {
    // Try exact match first
    const searchUrl = `${POWO_BASE}/search?q=${encodeURIComponent(scientificName)}&limit=1`;
    const res = await fetch(searchUrl);
    if (!res.ok) return null;

    const data = await res.json() as { results?: Array<{ fqId: string }> };
    if (!data.results || data.results.length === 0) return null;

    // Get full record
    const fqId = data.results[0].fqId;
    const detailUrl = `${POWO_BASE}/taxon/${fqId}`;
    const detailRes = await fetch(detailUrl);
    if (!detailRes.ok) return null;

    const detail = await detailRes.json() as POWOResult;
    return detail;
  } catch {
    return null;
  }
}

// ─── Common Name Corrections ───────────────────────────────────────

/**
 * Known misspellings and their corrections.
 * These are common errors found in AI-generated botanical databases.
 */
const KNOWN_CORRECTIONS: Record<string, string> = {
  "Aloe barbadensis": "Aloe vera",
  "Aloe barbadensis miller": "Aloe vera",
  "Curcuma longa (curcumin extract)": "Curcuma longa",
  "Curcuma longa var. okinawa": "Curcuma longa",
  "Curcuma longa var. australis": "Curcuma longa",
  "Zingiber officinale var. rubrum": "Zingiber officinale",
  "Salvia rosmarinus ct. cineole": "Salvia rosmarinus",
  "Eicosapentaenoic/Docosahexaenoic acid": "Fish oil (not a plant)",
  "S-Adenosyl methionine": "SAM-e (synthetic, not a plant)",
  "Gamma-aminobutyric acid": "GABA (endogenous compound)",
  "Dehydroepiandrosterone": "DHEA (hormone, not a plant)",
  "Methylsulfonylmethane": "MSM (synthetic compound)",
  "Cholecalciferol": "Vitamin D3 (not a plant)",
  "Ubiquinone": "Coenzyme Q10 (endogenous)",
  "Sarcosine precursor": "Creatine (endogenous compound)",
  "Mineral supplement": "Mineral (not a plant)",
  "Trace mineral": "Mineral (not a plant)",
  "Natural sugar": "D-Mannose (simple sugar)",
  "Shellfish-derived": "Glucosamine (animal-derived)",
  "Bovine cartilage": "Chondroitin (animal-derived)",
  "Bovine/marine": "Collagen (animal-derived)",
  "Synthetic/natural": "Alpha-Lipoic Acid (synthetic/natural)",
  "Apis mellifera": "Bee product (not a plant)",
  "Asphaltum punjabianum": "Shilajit (mineral resin)",
  "Glycine max": "Soybean (accepted name)",
  "Sophora japonica": "Styphnolobium japonicum",
};

// ─── Main ───────────────────────────────────────────────────────────

interface HerbValidation {
  slug: string;
  name: string;
  scientific_name: string;
  status: "valid" | "corrected" | "not_found" | "not_a_plant" | "skipped";
  corrected_name?: string;
  family?: string;
  notes?: string;
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  const shouldFix = process.argv.includes("--fix");
  const sampleSize = parseInt(process.argv[process.argv.indexOf("--sample") + 1] || "0");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("Missing Supabase credentials");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // Get herbs — sample or all
  console.log("🌿 Fetching herbs...");
  const { data: herbs } = await supabase
    .from("herbs")
    .select("id, name, slug, scientific_name")
    .eq("is_published", true)
    .order("name");

  if (!herbs) { console.error("No herbs found"); process.exit(1); }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sample = sampleSize > 0 ? (herbs as any[]).slice(0, sampleSize) : (herbs as any[]);
  console.log(`Validating ${sample.length} scientific names against POWO...`);

  const results: HerbValidation[] = [];
  let validated = 0;

  for (const herb of sample) {
    const sciName = herb.scientific_name as string;
    
    // Check known corrections first
    if (KNOWN_CORRECTIONS[sciName]) {
      results.push({
        slug: herb.slug,
        name: herb.name,
        scientific_name: sciName,
        status: "corrected",
        corrected_name: KNOWN_CORRECTIONS[sciName],
        notes: "Known correction applied",
      });
      validated++;
      continue;
    }

    // Check if it's not a plant
    if (sciName.includes("(not a plant)") || sciName.includes("endogenous") || 
        sciName.includes("synthetic") || sciName.includes("animal-derived") ||
        sciName.includes("mineral") || sciName.includes("Bee product")) {
      results.push({
        slug: herb.slug, name: herb.name, scientific_name: sciName,
        status: "not_a_plant",
        notes: "Non-plant substance — should this be in the database?",
      });
      validated++;
      continue;
    }

    // Skip names that are clearly not binomial (single words, formulas, etc.)
    if (!/^[A-Z][a-z]+ [a-z]/.test(sciName) && sciName.split(" ").length < 2) {
      results.push({
        slug: herb.slug, name: herb.name, scientific_name: sciName,
        status: "not_a_plant",
        notes: "Does not follow binomial nomenclature",
      });
      validated++;
      continue;
    }

    // Query POWO
    if (!isDryRun) {
      const powoResult = await searchPOWO(sciName);
      
      if (powoResult) {
        const isSynonym = powoResult.synonym;
        results.push({
          slug: herb.slug, name: herb.name, scientific_name: sciName,
          status: isSynonym ? "corrected" : "valid",
          corrected_name: isSynonym ? powoResult.acceptedName : undefined,
          family: powoResult.family,
          notes: isSynonym ? `Synonym → accepted: ${powoResult.acceptedName}` : `Family: ${powoResult.family}`,
        });
      } else {
        results.push({
          slug: herb.slug, name: herb.name, scientific_name: sciName,
          status: "not_found",
          notes: "Not found in POWO database",
        });
      }

      validated++;
      if (validated % 10 === 0) {
        console.log(`  Progress: ${validated}/${sample.length}`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      results.push({ slug: herb.slug, name: herb.name, scientific_name: sciName, status: "skipped" });
      validated++;
    }
  }

  // Report
  const valid = results.filter(r => r.status === "valid").length;
  const corrected = results.filter(r => r.status === "corrected").length;
  const notFound = results.filter(r => r.status === "not_found").length;
  const notPlants = results.filter(r => r.status === "not_a_plant").length;

  console.log(`\n📊 Results:`);
  console.log(`  Valid: ${valid}`);
  console.log(`  Corrected (synonyms): ${corrected}`);
  console.log(`  Not found in POWO: ${notFound}`);
  console.log(`  Not plants: ${notPlants}`);

  // Show corrections
  const toFix = results.filter(r => r.status === "corrected" && r.corrected_name);
  if (toFix.length > 0) {
    console.log(`\n🔧 Corrections available (${toFix.length}):`);
    toFix.slice(0, 20).forEach(r => {
      console.log(`  ${r.name}: "${r.scientific_name}" → "${r.corrected_name}"`);
    });
  }

  // Auto-fix if requested
  if (shouldFix && toFix.length > 0) {
    console.log(`\n🔧 Applying ${toFix.length} corrections...`);
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      console.error("Need SUPABASE_SERVICE_ROLE_KEY for --fix");
      process.exit(1);
    }
    const adminClient = createClient(url, serviceKey, { auth: { persistSession: false } });

    let fixed = 0;
    for (const r of toFix) {
      const { error } = await adminClient
        .from("herbs")
        .update({ scientific_name: r.corrected_name })
        .eq("slug", r.slug);
      if (error) {
        console.error(`  ❌ ${r.slug}: ${error.message}`);
      } else {
        fixed++;
      }
    }
    console.log(`  ✅ Fixed ${fixed} scientific names`);
  }
}

main().catch(console.error);
