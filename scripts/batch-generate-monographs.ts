import { createClient } from "@supabase/supabase-js";
import { generateMonograph } from "../src/lib/data/generate-monograph";

/**
 * Batch monograph generator — DRAFT ONLY.
 *
 * Generates structured text for published herbs that have no PUBLISHED
 * monograph, purely from fields already in the herbs row. It does not consult
 * any source, so its output must never be published as-is: this script is what
 * produced the 2,585 archived monographs in June 2026 whose mechanism claims
 * and citations were never checked against literature (see migration-era notes
 * and the page's Option B gate). Rows are therefore always written with
 * status = 'draft' and render nowhere.
 *
 * For content that can be shown to readers, use the grounded pipeline:
 *   npx tsx scripts/generate-pubmed-monograph.ts --batch --write
 * which cites a validated PMID for every claim.
 *
 * Usage: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/batch-generate-monographs.ts [batch-size]
 */

const BATCH_SIZE = parseInt(process.argv[2] || "100", 10);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: "public" },
});

interface Herb {
  id: string;
  slug: string;
  name: string;
  scientific_name: string;
  description: string | null;
  traditional_uses: string[] | null;
  modern_uses: string[] | null;
  active_compounds: string[] | null;
  evidence_level: string | null;
  contraindications: string[] | null;
  side_effects: string[] | null;
  dosage_adult: string | null;
  pregnancy_safe: boolean | null;
  nursing_safe: boolean | null;
  citations: unknown[] | null;
}

async function getExistingMonographSlugs(): Promise<Set<string>> {
  const slugs = new Set<string>();
  let offset = 0;
  const batchSize = 500;

  while (true) {
    // Only a PUBLISHED row means the catalog already has displayable content.
    // An archived/draft row (the June 2026 batch) must not block a fresh draft.
    const { data, error } = await supabase
      .from("herb_monographs")
      .select("herb_slug")
      .eq("status", "published")
      .range(offset, offset + batchSize - 1);

    if (error || !data || data.length === 0) break;

    for (const row of data) {
      slugs.add(row.herb_slug);
    }

    if (data.length < batchSize) break;
    offset += batchSize;
  }

  return slugs;
}

async function getAllPublishedHerbs(): Promise<Herb[]> {
  const herbs: Herb[] = [];
  let offset = 0;
  const batchSize = 500;

  while (true) {
    const { data, error } = await supabase
      .from("herbs")
      .select(
        "id, slug, name, scientific_name, description, traditional_uses, modern_uses, active_compounds, evidence_level, contraindications, side_effects, dosage_adult, pregnancy_safe, nursing_safe, citations"
      )
      .eq("is_published", true)
      .order("evidence_level", { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (error || !data || data.length === 0) break;

    herbs.push(...(data as Herb[]));

    if (data.length < batchSize) break;
    offset += batchSize;
  }

  return herbs;
}

async function main() {
  console.log(`\n🌿 HerbAlly Batch Monograph Generator`);
  console.log(`Batch size: ${BATCH_SIZE}\n`);

  // Get existing monograph slugs
  console.log("📋 Checking existing monographs...");
  const existingSlugs = await getExistingMonographSlugs();
  console.log(`   Found ${existingSlugs.size} existing monographs\n`);

  // Get all published herbs
  console.log("📋 Fetching published herbs...");
  const allHerbs = await getAllPublishedHerbs();
  console.log(`   Found ${allHerbs.length} published herbs\n`);

  // Filter to herbs without monographs
  const herbsToProcess = allHerbs.filter((h) => !existingSlugs.has(h.slug));
  console.log(`   ${herbsToProcess.length} herbs need monographs\n`);

  if (herbsToProcess.length === 0) {
    console.log("✅ All herbs already have monographs!");
    process.exit(0);
  }

  // Process in batches
  const batch = herbsToProcess.slice(0, BATCH_SIZE);
  console.log(`Processing batch of ${batch.length} herbs...\n`);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < batch.length; i++) {
    const herb = batch[i];
    const progress = `[${i + 1}/${batch.length}]`;

    process.stdout.write(`${progress} ${herb.slug}... `);

    try {
      // Generate monograph
      const monograph = generateMonograph({
        name: herb.name,
        scientific_name: herb.scientific_name,
        slug: herb.slug,
        description: herb.description,
        traditional_uses: herb.traditional_uses,
        modern_uses: herb.modern_uses,
        active_compounds: herb.active_compounds,
        evidence_level: herb.evidence_level,
        contraindications: herb.contraindications,
        side_effects: herb.side_effects,
        dosage_adult: herb.dosage_adult,
        pregnancy_safe: herb.pregnancy_safe,
        nursing_safe: herb.nursing_safe,
        drug_interactions: [], // From separate table, not needed for generation
        citations: herb.citations,
      });

      if (!monograph) {
        console.log("⏭️  Skipped (generator returned null)");
        skipped++;
        continue;
      }

      // Store in database. Always draft: this text has no source behind it and
      // must be reviewed before it can be shown (see the file header).
      const { error } = await supabase.from("herb_monographs").upsert(
        {
          herb_id: herb.id,
          herb_slug: herb.slug,
          summary: monograph.summary,
          mechanism: monograph.mechanism,
          claims: monograph.claims,
          safety_notes: monograph.safetyNotes,
          drug_interactions: monograph.drugInteractions,
          pregnancy_category: monograph.pregnancyCategory,
          key_citations: monograph.keyCitations,
          status: "draft",
          generation_method: "auto-generated",
          reviewed_by: null,
          reviewer_credentials: null,
        },
        { onConflict: "herb_slug" }
      );

      if (error) {
        console.log(`❌ ${error.message}`);
        failed++;
      } else {
        console.log("✅");
        success++;
      }
    } catch (error) {
      console.log(`❌ ${error}`);
      failed++;
    }

    // Small delay to avoid rate limiting
    if (i % 50 === 0 && i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  console.log(`\n📊 Batch Complete`);
  console.log(`   Success: ${success}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total: ${batch.length}`);

  const remaining = herbsToProcess.length - batch.length;
  console.log(`\n📝 Remaining herbs: ${remaining}`);
  console.log(
    `   Run again with batch size ${remaining} to process all remaining\n`
  );
}

main().catch(console.error);
