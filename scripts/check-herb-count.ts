import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import * as fs from "fs";
config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) { console.log("No creds"); process.exit(1); }
  const supabase = createClient(url, key);

  // Get all DB slugs
  const { data } = await supabase
    .from("herbs")
    .select("slug")
    .eq("is_published", true);

  const dbSlugs = new Set((data as Array<{ slug: string }> ?? []).map(r => r.slug));
  console.log(`DB has ${dbSlugs.size} unique slugs`);

  // Get seed file slugs
  const seedContent = fs.readFileSync("supabase/migrations/00015_seed_herbs.sql", "utf-8");
  const seedSlugs: string[] = [];
  const matches = seedContent.matchAll(/^\s+'([a-z][a-z0-9-]*)'/gm);
  for (const m of matches) {
    seedSlugs.push(m[1]);
  }

  console.log(`Seed file has ${seedSlugs.length} herbs`);

  // Find which seed herbs are missing from DB
  const missing = seedSlugs.filter(s => !dbSlugs.has(s));
  const present = seedSlugs.filter(s => dbSlugs.has(s));

  console.log(`\nSeed herbs in DB: ${present.length}/${seedSlugs.length}`);
  console.log(`Seed herbs MISSING from DB: ${missing.length}`);

  if (missing.length > 0) {
    console.log("\n❌ Seed herbs NOT in production DB:");
    missing.forEach(s => console.log(`  - ${s}`));
  }

  // Also check: which DB herbs have the same name as seed herbs but different slugs?
  console.log("\n--- Herbs present but under variant slugs ---");
  const seedNames = new Map<string, string>(); // slug → name
  const nameLines = seedContent.matchAll(/^\s+'([a-z][a-z0-9-]*?)',\s*'([^']+)'/gm);
  for (const m of nameLines) {
    seedNames.set(m[1], m[2]);
  }

  // Get DB herbs with names
  const { data: dbHerbs } = await supabase
    .from("herbs")
    .select("name, slug")
    .eq("is_published", true);

  if (dbHerbs) {
    for (const [seedSlug, seedName] of seedNames) {
      if (!dbSlugs.has(seedSlug)) {
        // Check if a herb with similar name exists under different slug
        const similar = (dbHerbs as Array<{ name: string; slug: string }>).filter(h =>
          h.name.toLowerCase().includes(seedName.toLowerCase()) ||
          seedName.toLowerCase().includes(h.name.toLowerCase())
        );
        if (similar.length > 0) {
          console.log(`  ${seedName} (${seedSlug}) → found as: ${similar.map(h => `${h.name} (${h.slug})`).join(", ")}`);
        }
      }
    }
  }
}

main();
