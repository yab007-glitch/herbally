import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) { console.log("No creds"); process.exit(1); }
  const supabase = createClient(url, key);

  const slugs = ["aloe-vera", "arnica", "comfrey", "tea-tree", "witch-hazel", "eucalyptus", "butterbur", "ashwagandha", "turmeric"];
  const { data } = await supabase
    .from("herbs")
    .select("name, pregnancy_safe_oral, pregnancy_safe_topical, nursing_safe_oral, nursing_safe_topical")
    .in("slug", slugs)
    .eq("is_published", true);

  if (data) {
    for (const h of data as any[]) {
      console.log(`${h.name}: oral(p=${h.pregnancy_safe_oral}, n=${h.nursing_safe_oral}) topical(p=${h.pregnancy_safe_topical}, n=${h.nursing_safe_topical})`);
    }
  }

  // Count how many have oral ≠ topical (dual-route herbs)
  const { data: all } = await supabase
    .from("herbs")
    .select("pregnancy_safe_oral, pregnancy_safe_topical")
    .eq("is_published", true)
    .not("pregnancy_safe_oral", "is", null)
    .limit(500);

  if (all) {
    const dual = all.filter((h: any) => h.pregnancy_safe_oral !== h.pregnancy_safe_topical);
    console.log(`\nDual-route herbs (sample): ${dual.length}/${all.length}`);
  }
}

main();
