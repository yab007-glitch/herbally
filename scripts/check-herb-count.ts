import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

// ─── Reference list: medically recognized herbs ────────────────────
const REFERENCE_SLUGS = new Set([
  "ashwagandha","rhodiola","holy-basil","eleuthero","schisandra","maca",
  "american-ginseng","ginseng","cordyceps","reishi","turmeric","ginger",
  "boswellia","devils-claw","willow-bark","cats-claw","andrographis",
  "peppermint","chamomile","artichoke","milk-thistle","fennel","psyllium",
  "slippery-elm","licorice-root","marshmallow-root","ginkgo-biloba","bacopa",
  "gotu-kola","lions-mane","saffron","sage","valerian","passionflower",
  "lavender","lemon-balm","hops","skullcap","kava","echinacea","elderberry",
  "garlic","astragalus","oregano","olive-leaf","neem","hawthorn","green-tea",
  "black-cohosh","vitex","dong-quai","evening-primrose","red-clover",
  "fenugreek","saw-palmetto","pygeum","tongkat-ali","tribulus","aloe-vera",
  "calendula","tea-tree","witch-hazel","arnica","comfrey","mullein","thyme",
  "elderflower","butterbur","yarrow","cinnamon","berberine","gymnema",
  "moringa","feverfew","cayenne","spirulina","chlorella","nettle","cranberry",
  "uva-ursi","dandelion","bilberry","goldenseal","black-seed","clove",
  "st-johns-wort","horsetail","rosemary","coleus","garcinia","horse-chestnut",
  "turkey-tail","chaga","black-walnut","wormwood","white-willow","meadowsweet",
  "plantain","milk-vetch","java-turmeric","nettle-root","curcumin",
  "sambucol",
]);

// ─── Seed file slugs ────────────────────────────────────────────────
import * as fs from "fs";
const seedContent = fs.readFileSync("supabase/migrations/00015_seed_herbs.sql", "utf-8");
const seedSlugs = new Set<string>();
const matches = seedContent.matchAll(/^\s+'([a-z][a-z0-9-]*)'/gm);
for (const m of matches) {
  seedSlugs.add(m[1]);
}

console.log(`Reference herbs: ${REFERENCE_SLUGS.size}`);
console.log(`Seed file herbs: ${seedSlugs.size}`);

// Find missing
const missing = [...REFERENCE_SLUGS].filter(s => !seedSlugs.has(s));
const inBoth = [...REFERENCE_SLUGS].filter(s => seedSlugs.has(s));
const onlyInSeed = [...seedSlugs].filter(s => !REFERENCE_SLUGS.has(s));

console.log(`\nIn both: ${inBoth.length}`);
console.log(`Missing from seed: ${missing.length}`);
console.log(`Only in seed: ${onlyInSeed.length}`);

if (missing.length > 0) {
  console.log("\n❌ MISSING — medically recognized herbs not in seed database:");
  missing.sort().forEach(s => console.log(`  - ${s}`));
}

if (onlyInSeed.length > 0) {
  console.log("\nℹ️ In seed but not in reference list:");
  onlyInSeed.sort().forEach(s => console.log(`  - ${s}`));
}

// ─── Try DB if available ────────────────────────────────────────────
async function checkDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.log("\n⚠️ No Supabase credentials — DB check skipped.");
    return;
  }

  const supabase = createClient(url, key);
  const { count, error } = await supabase
    .from("herbs")
    .select("*", { count: "exact", head: true })
    .eq("is_published", true);

  if (error) {
    console.log(`\n⚠️ DB error: ${error.message}`);
    return;
  }

  console.log(`\n📊 Production database: ${count} published herbs`);

  // Check which reference herbs are in DB
  const { data } = await supabase
    .from("herbs")
    .select("slug")
    .eq("is_published", true);

  if (data) {
    const dbSlugs = new Set((data as Array<{ slug: string }>).map(r => r.slug));
    const missingFromDB = [...REFERENCE_SLUGS].filter(s => !dbSlugs.has(s));
    console.log(`Reference herbs in DB: ${[...REFERENCE_SLUGS].filter(s => dbSlugs.has(s)).length}/${REFERENCE_SLUGS.size}`);
    if (missingFromDB.length > 0) {
      console.log(`\n❌ Missing from production DB (${missingFromDB.length}):`);
      missingFromDB.sort().forEach(s => console.log(`  - ${s}`));
    }
  }
}

checkDB();
