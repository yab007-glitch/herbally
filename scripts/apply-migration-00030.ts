/**
 * Apply migration 00030 via Supabase client (individual updates).
 * Can't use direct PG connection or raw SQL — using REST API instead.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const COMMON_SLUGS = new Set([
  "turmeric", "ginger", "echinacea", "st-johns-wort", "ginkgo-biloba",
  "garlic", "ashwagandha", "valerian", "chamomile", "peppermint",
  "lavender", "aloe-vera", "ginseng", "green-tea", "milk-thistle",
  "black-cohosh", "elderberry", "saw-palmetto", "licorice-root", "feverfew",
  "hawthorn", "passionflower", "rhodiola", "holy-basil", "dong-quai",
  "cats-claw", "evening-primrose", "nettle", "dandelion", "red-clover",
  "cranberry", "oregano", "rosemary", "thyme", "sage", "cinnamon",
  "fenugreek", "moringa", "neem", "spirulina", "chlorella", "maca",
  "tribulus", "astragalus", "reishi", "lions-mane", "cordyceps", "chaga",
  "turkey-tail", "saffron", "kava", "lemon-balm", "berberine", "goldenseal",
  "slippery-elm", "marshmallow-root", "mullein", "black-seed", "boswellia",
  "devils-claw", "willow-bark", "butterbur", "hops", "skullcap", "yarrow",
  "eleuthero", "american-ginseng", "schisandra", "gotu-kola", "bacopa",
  "elderflower", "calendula", "arnica", "tea-tree", "witch-hazel",
  "horse-chestnut", "bilberry", "gymnema", "vitex", "comfrey",
  "java-turmeric", "meadowsweet", "plantain", "olive-leaf", "milk-vetch",
  "white-willow", "uva-ursi", "pygeum", "andrographis", "coleus",
  "clove", "fennel", "artichoke", "psyllium", "black-walnut",
  "tongkat-ali", "wormwood", "sambucol", "curcumin", "nettle-root",
  "cayenne", "horsetail", "garcinia", "panax-ginseng", "siberian-ginseng",
  "shilajit", "guduchi", "pine-bark", "grape-seed", "quercetin",
  "bromelain", "gentian", "cardamom", "triphala",
  "huperzine-a", "phosphatidylserine", "vinpocetine", "creatine",
  "coenzyme-q10", "red-yeast-rice", "arjuna", "resveratrol", "aged-garlic",
  "magnolia-bark", "l-theanine", "5-htp", "melissa", "gaba-supplement",
  "elderberry-extract", "beta-glucan", "zinc", "vitamin-d",
  "shatavari", "raspberry-leaf", "cramp-bark", "motherwort",
  "pumpkin-seed", "stinging-nettle-root", "dhea",
  "glucosamine", "chondroitin", "msm", "collagen", "curcumin-extract",
  "eucalyptus", "pelargonium", "ivy-leaf", "thyme-extract",
  "alpha-lipoic-acid", "chromium", "banaba",
  "white-willow-extract", "magnesium",
  "grapefruit-seed", "pau-darco", "usnea",
  "bupleurum", "dandelion-root",
  "sam-e", "tyrosine", "tryptophan",
  "lutein", "zeaxanthin", "astaxanthin",
  "d-mannose", "maitake", "shiitake", "agaricus",
  "blue-vervain", "wood-betony", "damiana", "mugwort",
  "bee-pollen", "royal-jelly", "propolis", "wheatgrass", "barley-grass",
  "shea-butter", "jojoba", "rosehip", "centella",
]);

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("Missing creds"); process.exit(1); }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Step 1: Create "Not Common" category
  console.log("Step 1: Creating 'Not Common' category...");
  const { data: cat, error: catErr } = await supabase
    .from("herb_categories")
    .upsert({
      name: "Not Common",
      slug: "not-common",
      description: "Herbs that are rare, hard to find, or have limited documentation.",
      icon: "archive",
      sort_order: 21,
    }, { onConflict: "slug" })
    .select("id")
    .single();

  if (catErr) {
    // Might already exist
    const { data: existing } = await supabase
      .from("herb_categories")
      .select("id")
      .eq("slug", "not-common")
      .single();
    
    if (!existing) {
      console.error("Failed to create category:", catErr.message);
      process.exit(1);
    }
    console.log(`✅ Category already exists (id: ${existing.id})`);
  } else {
    console.log(`✅ Category created (id: ${cat.id})`);
  }

  // Get category ID
  const { data: notCommonCat } = await supabase
    .from("herb_categories")
    .select("id")
    .eq("slug", "not-common")
    .single();

  if (!notCommonCat) {
    console.error("Could not find 'not-common' category");
    process.exit(1);
  }

  const notCommonId = notCommonCat.id;
  console.log(`Category ID: ${notCommonId}`);

  // Step 2: Fetch all herbs and categorize
  console.log("\nStep 2: Categorizing herbs...");
  
  // Get all herb slugs with pagination
  const herbSlugs: string[] = [];
  let page = 0;
  
  while (true) {
    const { data } = await supabase
      .from("herbs")
      .select("slug")
      .eq("is_published", true)
      .order("name")
      .range(page * 1000, (page + 1) * 1000 - 1);
    
    if (!data || data.length === 0) break;
    herbSlugs.push(...data.map((h: any) => h.slug));
    if (data.length < 1000) break;
    page++;
  }

  console.log(`Total herbs: ${herbSlugs.length}`);

  // Find herbs to move to "Not Common"
  const toMove = herbSlugs.filter(s => !COMMON_SLUGS.has(s));
  console.log(`Herbs to move to "Not Common": ${toMove.length}`);
  console.log(`Common herbs staying in place: ${herbSlugs.length - toMove.length}`);

  // Update in batches of 100
  let moved = 0;
  let errors = 0;
  
  for (let i = 0; i < toMove.length; i++) {
    const slug = toMove[i];
    const { error } = await supabase
      .from("herbs")
      .update({ category_id: notCommonId })
      .eq("slug", slug);
    
    if (error) {
      errors++;
      if (errors <= 5) console.error(`  ❌ ${slug}: ${error.message}`);
    } else {
      moved++;
    }
    
    if ((moved + errors) % 200 === 0) {
      console.log(`  Progress: ${moved + errors}/${toMove.length} (${moved} ok, ${errors} err)`);
    }
  }

  console.log(`\n✅ Done: ${moved} moved to "Not Common", ${errors} errors`);

  // Verify
  const { count } = await supabase
    .from("herbs")
    .select("*", { count: "exact", head: true })
    .eq("is_published", true)
    .eq("category_id", notCommonId);

  console.log(`📊 Verification: ${count} herbs in "Not Common" category`);
}

main().catch(console.error);
