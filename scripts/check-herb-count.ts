import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) { console.log("No creds"); process.exit(1); }
  const supabase = createClient(url, key);

  const { data: cats } = await supabase
    .from("herb_categories")
    .select("id, name, slug")
    .order("sort_order");

  if (cats) {
    console.log("Category distribution:");
    for (const cat of cats as any[]) {
      const { count } = await supabase
        .from("herbs")
        .select("*", { count: "exact", head: true })
        .eq("is_published", true)
        .eq("category_id", cat.id);
      console.log(`  ${cat.name} (${cat.slug}): ${count} herbs`);
    }
  }
}

main();
