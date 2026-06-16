import { createClient } from "@supabase/supabase-js";
import { monographs } from "../src/lib/data/monographs";

/**
 * Seed hand-written monographs into the database
 *
 * Usage: npx tsx scripts/seed-monographs.ts
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log(
    `\n🌿 Seeding ${Object.keys(monographs).length} premium monographs...\n`
  );

  let success = 0;
  let failed = 0;

  for (const [slug, monograph] of Object.entries(monographs)) {
    const { data: herb, error: herbError } = await supabase
      .from("herbs")
      .select("id, slug")
      .eq("slug", slug)
      .eq("is_published", true)
      .single();

    if (herbError || !herb) {
      console.log(`  ⚠️  Herb "${slug}" not found in database, skipping`);
      failed++;
      continue;
    }

    const { error: upsertError } = await supabase
      .from("herb_monographs")
      .upsert(
        {
          herb_id: herb.id,
          herb_slug: slug,
          summary: monograph.summary,
          mechanism: monograph.mechanism,
          claims: monograph.claims,
          safety_notes: monograph.safetyNotes,
          drug_interactions: monograph.drugInteractions,
          pregnancy_category: monograph.pregnancyCategory,
          key_citations: monograph.keyCitations,
          status: "published",
          generation_method: "manual",
          reviewed_by: "HerbAlly Editorial Team",
          reviewer_credentials:
            "Medical herbalists and healthcare professionals",
          last_reviewed_at: new Date().toISOString(),
          provenance: {
            verification_method: "manual",
            reviewed_by_human: true,
            source: "hand_written_editorial",
          },
        },
        { onConflict: "herb_slug" }
      );

    if (upsertError) {
      console.log(`  ❌ ${slug}: ${upsertError.message}`);
      failed++;
    } else {
      console.log(`  ✅ ${slug}`);
      success++;
    }
  }

  console.log(`\n📊 Seed Complete`);
  console.log(`   Success: ${success}`);
  console.log(`   Failed: ${failed}\n`);
}

main().catch(console.error);
