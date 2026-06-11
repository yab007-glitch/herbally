import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) { console.log("No creds"); process.exit(1); }
  const supabase = createClient(url, key);

  // Check what citations look like
  const { data } = await supabase
    .from("herbs")
    .select("name, slug, scientific_name, citations")
    .eq("is_published", true)
    .limit(10);

  if (!data) { console.log("No data"); process.exit(1); }

  for (const h of data as any[]) {
    console.log(`\n${h.name} (${h.scientific_name}):`);
    console.log(`  Citations: ${JSON.stringify(h.citations).substring(0, 300)}`);
  }
}

main();
