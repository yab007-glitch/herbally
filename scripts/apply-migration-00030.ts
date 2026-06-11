/**
 * Fix: Move Level A and B herbs from "Not Common" to appropriate therapeutic categories.
 * Level C herbs stay in "Not Common" since they lack strong evidence.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

// Map herb names to therapeutic categories based on keywords
function inferCategory(name: string): string | null {
  const lower = name.toLowerCase();
  if (/adaptogen|ashwagandha|rhodiola|ginseng|maca|schisandra|eleuthero|cordyceps|reishi|holy.?basil/.test(lower)) return "adaptogen";
  if (/turmeric|curcumin|ginger|boswellia|devil|willow|bark|cats.?claw|frankincense|anti.?inflam/.test(lower)) return "anti-inflammatory";
  if (/peppermint|chamomile|milk.?thistle|artichoke|fennel|psyllium|slippery.?elm|licorice|marshmallow|digest|gentian|triphala/.test(lower)) return "digestive";
  if (/ginkgo|bacopa|gotu.?kola|lion.?s?mane|saffron|sage|cognit|memory|nootropic/.test(lower)) return "nootropic";
  if (/valerian|passion.?flower|lavender|lemon.?balm|hops|skullcap|kava|melissa|sleep|anxiety|nervine/.test(lower)) return "nervine";
  if (/echinacea|elderberry|garlic|astragalus|oregano|immune|elderflower|black.?seed|neem/.test(lower)) return "immune-support";
  if (/hawthorn|green.?tea|olive.?leaf|cardiovascular|heart|blood.?pressure|arjuna|resveratrol/.test(lower)) return "cardiovascular";
  if (/black.?cohosh|vitex|dong.?quai|evening.?primrose|red.?clover|fenugreek|womens|shatavari|raspberry/.test(lower)) return "womens-health";
  if (/saw.?palmetto|pygeum|tongkat.?ali|tribulus|mens|pumpkin.?seed/.test(lower)) return "mens-health";
  if (/aloe.?vera|calendula|tea.?tree|witch.?hazel|arnica|comfrey|skin|topical|shea|jojoba|rosehip/.test(lower)) return "skin-topical";
  if (/mullein|thyme|elderflower|butterbur|yarrow|respir|cough|eucalyptus|pelargonium|ivy/.test(lower)) return "respiratory";
  if (/cinnamon|fenugreek|berberine|gymnema|moringa|metabolic|blood.?sugar|chromium|banaba/.test(lower)) return "metabolic";
  if (/spirulina|chlorella|moringa|nettle|nutrit|wheatgrass|barley|bee.?pollen|royal.?jelly/.test(lower)) return "nutritive";
  if (/cranberry|uva.?ursi|dandelion|urinary|kidney/.test(lower)) return "urinary";
  if (/bilberry|lutein|zeaxanthin|astaxanthin|eye|vision/.test(lower)) return "antioxidant";
  if (/goldenseal|black.?seed|clove|oregano|antimicrobial|propolis|grapefruit|usnea/.test(lower)) return "antimicrobial";
  if (/milk.?thistle|dandelion|schisandra|artichoke|liver|bupleurum/.test(lower)) return "liver-support";
  if (/st.?john|saffron|rhodiola|ashwagandha|mood|depress|sam-e|5-htp|tryptophan/.test(lower)) return "nervine";
  if (/glucosamine|chondroitin|msm|collagen|boswellia|devil|joint|bone|musculo/.test(lower)) return "musculoskeletal";
  if (/cayenne|feverfew|butterbur|willow|pain|analgesic|magnesium/.test(lower)) return "analgesic";
  if (/coenzyme|creatine|alpha.?lipoic|magnesium|zinc|vitamin.?d|l-theanine/.test(lower)) return "nutritive";
  return null;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("Missing creds"); process.exit(1); }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Get "Not Common" category ID
  const { data: ncCat } = await supabase
    .from("herb_categories")
    .select("id")
    .eq("slug", "not-common")
    .single();
  if (!ncCat) { console.error("No not-common category"); process.exit(1); }

  // Get category ID map
  const { data: allCats } = await supabase
    .from("herb_categories")
    .select("id, slug")
    .neq("slug", "not-common");
  const catMap = new Map<string, string>();
  if (allCats) {
    for (const c of allCats as any[]) {
      catMap.set(c.slug, c.id);
    }
  }

  // Get Level A and B herbs from "Not Common"
  console.log("Fetching Level A/B herbs from 'Not Common'...");
  const { data: levelAB } = await supabase
    .from("herbs")
    .select("id, name, slug, evidence_level")
    .eq("is_published", true)
    .eq("category_id", ncCat.id)
    .in("evidence_level", ["A", "B"]);

  if (!levelAB || levelAB.length === 0) {
    console.log("No Level A/B herbs found in Not Common");
    process.exit(0);
  }

  console.log(`Found ${levelAB.length} Level A/B herbs to reclassify`);

  let moved = 0;
  let skipped = 0;
  let errors = 0;

  for (const herb of levelAB as any[]) {
    const category = inferCategory(herb.name);
    
    if (category && catMap.has(category)) {
      const { error } = await supabase
        .from("herbs")
        .update({ category_id: catMap.get(category) })
        .eq("id", herb.id);
      
      if (error) {
        errors++;
        if (errors <= 5) console.error(`  ❌ ${herb.name}: ${error.message}`);
      } else {
        moved++;
      }
    } else {
      skipped++;
    }
  }

  console.log(`\n✅ Moved: ${moved} | Skipped (no category match): ${skipped} | Errors: ${errors}`);

  // Verify
  const { count: ncCount } = await supabase
    .from("herbs")
    .select("*", { count: "exact", head: true })
    .eq("is_published", true)
    .eq("category_id", ncCat.id);
  
  const { count: totalCommon } = await supabase
    .from("herbs")
    .select("*", { count: "exact", head: true })
    .eq("is_published", true)
    .neq("category_id", ncCat.id);

  console.log(`\n📊 Herbs in "Not Common": ${ncCount}`);
  console.log(`📊 Herbs in therapeutic categories: ${totalCommon}`);
}

main().catch(console.error);
