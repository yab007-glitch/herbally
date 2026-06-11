import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) { console.log("No creds"); process.exit(1); }
  const supabase = createClient(url, key);

  // Get all herbs with full data
  const { data } = await supabase
    .from("herbs")
    .select("id, name, slug, scientific_name")
    .eq("is_published", true)
    .order("name");

  if (!data) { console.log("No data"); process.exit(1); }
  const herbs = data as Array<{ id: string; name: string; slug: string; scientific_name: string }>;

  // Find EXACT duplicates: same scientific_name, different slugs
  const bySciName = new Map<string, Array<{ id: string; name: string; slug: string }>>();
  for (const h of herbs) {
    const key = h.scientific_name.toLowerCase().trim();
    if (!bySciName.has(key)) bySciName.set(key, []);
    bySciName.get(key)!.push(h);
  }

  console.log("--- EXACT duplicates (same scientific name) ---");
  const toDelete: string[] = [];
  for (const [sci, entries] of bySciName) {
    if (entries.length > 1) {
      // Keep the one with the shortest/cleanest slug, delete others
      entries.sort((a, b) => a.slug.length - b.slug.length);
      const keep = entries[0];
      const remove = entries.slice(1);
      console.log(`  ${sci}:`);
      console.log(`    KEEP: ${keep.name} (${keep.slug})`);
      remove.forEach(r => {
        console.log(`    DELETE: ${r.name} (${r.slug})`);
        toDelete.push(r.id);
      });
    }
  }
  console.log(`\nTotal exact duplicates to delete: ${toDelete.length}`);

  // Find NEAR duplicates: very similar names where one is clearly a variant
  // These are cases like "Ethiopian Turmeric" vs "Turmeric" where the common
  // name version exists and the variant is just a regional subtype
  const COMMON_SLUGS = new Set([
    "turmeric", "ginger", "echinacea", "garlic", "ashwagandha", "valerian",
    "chamomile", "peppermint", "lavender", "aloe-vera", "ginseng", "green-tea",
    "milk-thistle", "elderberry", "saw-palmetto", "licorice-root", "feverfew",
    "hawthorn", "passionflower", "rhodiola", "cranberry", "oregano", "rosemary",
    "thyme", "sage", "cinnamon", "fenugreek", "moringa", "spirulina", "neem",
    "reishi", "cordyceps", "saffron", "kava", "lemon-balm", "goldenseal",
    "boswellia", "black-seed", "dandelion", "nettle", "maca", "astragalus",
    "holy-basil", "bacopa", "gotu-kola", "calendula", "arnica", "tea-tree",
    "witch-hazel", "bilberry", "vitex", "yarrow", "clove", "fennel",
    "artichoke", "psyllium", "chaga", "turkey-tail", "slippery-elm",
    "marshmallow-root", "mullein", "butterbur", "hops", "skullcap",
    "eleuthero", "schisandra", "elderflower", "gymnema", "comfrey",
    "uva-ursi", "pygeum", "andrographis", "coleus", "wormwood",
    "tongkat-ali", "cats-claw", "olive-leaf", "cayenne", "horsetail",
    "garcinia", "cardamom", "triphala", "eucalyptus", "lutein",
    "zeaxanthin", "astaxanthin", "magnesium", "zinc", "vitamin-d",
    "creatine", "collagen", "glucosamine", "chondroitin", "msm",
    "coenzyme-q10", "resveratrol", "quercetin", "bromelain",
    "alpha-lipoic-acid", "chromium", "l-theanine", "tyrosine",
    "tryptophan", "sam-e", "5-htp", "dhea", "gaba-supplement",
    "melissa", "passionflower", "valerian", "chamomile",
  ]);

  console.log("\n--- Regional variants to merge ---");
  const variantDeletes: string[] = [];
  for (const h of herbs) {
    if (COMMON_SLUGS.has(h.slug)) continue; // Skip the common herb itself
    
    const nameLower = h.name.toLowerCase();
    // Check if this is a variant of a common herb
    for (const commonSlug of COMMON_SLUGS) {
      const commonHerb = herbs.find(ch => ch.slug === commonSlug);
      if (!commonHerb) continue;
      
      const commonNameLower = commonHerb.name.toLowerCase();
      
      // Check if the variant name contains the common name
      // e.g., "Ethiopian Turmeric" contains "turmeric"
      // e.g., "Afghan Ashwagandha" contains "ashwagandha"
      // e.g., "Anatolian Fenugreek" contains "fenugreek"
      // e.g., "Cassia Cinnamon" contains "cinnamon"
      // e.g., "Cat Thyme" contains "thyme" — wait, no it doesn't. "Cat Thyme" doesn't contain "thyme" as a word
      
      // Better check: the common name is a significant substring of the variant name
      if (nameLower.includes(commonNameLower) && nameLower !== commonNameLower) {
        // Only merge if the variant name is clearly "X CommonName" pattern
        // and not a different species (e.g., "Acacia arabica" contains "acacia" but is a different species)
        
        // Check if the variant is just a regional prefix + common name
        const prefix = nameLower.replace(commonNameLower, "").trim();
        const isRegionalPrefix = /^(afghan|ethiopian|anatolian|andhra|bengali|bolivian|cassia|cat|cuban|czech|java|persian|siberian|white|black|red|blue|green|wild|chinese|indian|african|american|european|brazilian|roman|greek|turkish|spanish|french|german|italian|japanese|korean|thai|vietnamese|nepali|tibetan|himalayan|amazonian|andes|patagonian|caribbean|mediterranean|arabian|persian|levantine|balkan|scandinavian|nordic|baltic|slavic|celtic|gaelic|welsh|scottish|irish|english|dutch|belgian|swiss|austrian|hungarian|polish|romanian|bulgarian|serbian|croatian|albanian|macedonian|montenegrin|bosnian|slovenian|estonian|latvian|lithuanian|finnish|icelandic|norwegian|danish|swedish|portuguese|basque|catalan|galician|andalusian|castilian|aragonese|asturian|canarian|majorcan|minorcan|ibizan|sicilian|sardinian|corsican|maltese|cypriot|cretan|aegean|ionian|cycladic|dodecanese|peloponnesian|macedonian|thracian|epirus|thessalian|attic|boeotian|arcadian|laconian|messinian|achaean|elean|argolic|corinthian|megarian|aetolian|acarnanian|phocian|locrian|dorian|ionian|aeolian)$/i;
        
        if (isRegionalPrefix.test(prefix)) {
          console.log(`  MERGE: ${h.name} (${h.slug}) → ${commonHerb.name} (${commonHerb.slug})`);
          variantDeletes.push(h.id);
          break;
        }
      }
    }
  }
  console.log(`\nTotal regional variants to merge: ${variantDeletes.length}`);

  // Output SQL for deletes
  if (toDelete.length > 0 || variantDeletes.length > 0) {
    console.log("\n--- SQL to execute ---");
    const allDeletes = [...toDelete, ...variantDeletes];
    console.log(`-- Delete ${allDeletes.length} duplicate/variant herbs`);
    for (const id of allDeletes) {
      console.log(`DELETE FROM public.herbs WHERE id = '${id}';`);
    }
  }
}

main();
