/**
 * Apply migration 00031 — parse jsonb_build_array format and update via client.
 * The AND (citations IS NULL...) clause blocks updates on herbs with placeholder citations,
 * so we bypass it by updating directly via the Supabase client.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import * as fs from "fs";

config({ path: ".env.local" });
config({ path: ".env" });

function parseJsonbBuildArray(
  sql: string
): Array<{ slug: string; citations: unknown[] }> {
  const results: Array<{ slug: string; citations: unknown[] }> = [];

  // Match blocks: SET citations = jsonb_build_array(...) WHERE slug = 'xxx'
  const blockRegex =
    /SET citations = jsonb_build_array\(([\s\S]*?)\)\s*WHERE slug = '([a-z0-9-]+)'/g;
  let match;

  while ((match = blockRegex.exec(sql)) !== null) {
    const arrayContent = match[1];
    const slug = match[2];

    // Parse individual jsonb_build_object calls
    const citations: unknown[] = [];
    const objRegex = /jsonb_build_object\(([^)]+)\)/g;
    let objMatch;

    while ((objMatch = objRegex.exec(arrayContent)) !== null) {
      const fields = objMatch[1];
      const obj: Record<string, unknown> = {};

      // Parse key-value pairs: 'key', 'value'
      const kvRegex = /'(\w+)',\s*'([^']*)'/g;
      let kvMatch;
      while ((kvMatch = kvRegex.exec(fields)) !== null) {
        const key = kvMatch[1];
        let value: unknown = kvMatch[2];
        // Handle year as number
        if (key === "year") value = parseInt(kvMatch[2]);
        // Handle escaped quotes
        if (typeof value === "string") value = value.replace(/''/g, "'");
        obj[key] = value;
      }

      if (Object.keys(obj).length > 0) {
        citations.push(obj);
      }
    }

    if (citations.length > 0) {
      results.push({ slug, citations });
    }
  }

  return results;
}

function parseJsonStringFormat(
  sql: string
): Array<{ slug: string; citations: unknown[] }> {
  const results: Array<{ slug: string; citations: unknown[] }> = [];

  // Match: SET citations = '[...json...]'::jsonb WHERE slug = 'xxx'
  // The JSON may contain escaped single quotes ('')
  // We need to find the matching closing quote before ::jsonb

  // Simpler approach: find all slug references and extract their citation data
  const slugRegex = /WHERE slug = '([a-z0-9-]+)'/g;
  let slugMatch;
  const slugs = new Set<string>();
  while ((slugMatch = slugRegex.exec(sql)) !== null) {
    slugs.add(slugMatch[1]);
  }

  // For each slug, find its SET clause
  for (const slug of slugs) {
    // Find the full UPDATE statement for this slug
    const stmtRegex = new RegExp(
      `UPDATE public\\.herbs SET citations = '(\[[^]]*\\])'::jsonb WHERE slug = '${slug}'`,
      "s"
    );
    const stmtMatch = stmtRegex.exec(sql);
    if (stmtMatch) {
      try {
        const jsonStr = stmtMatch[1].replace(/''/g, "'");
        const citations = JSON.parse(jsonStr);
        if (Array.isArray(citations) && citations.length > 0) {
          results.push({ slug, citations });
        }
      } catch {
        // Skip
      }
    }
  }

  return results;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing creds");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const sql = fs.readFileSync(
    "supabase/migrations/00031_add_pubmed_citations.sql",
    "utf-8"
  );

  // Try both formats
  let updates = parseJsonbBuildArray(sql);
  console.log(`Parsed ${updates.length} from jsonb_build_array format`);

  const jsonUpdates = parseJsonStringFormat(sql);
  console.log(`Parsed ${jsonUpdates.length} from JSON string format`);

  // Merge (jsonb format takes priority)
  const slugSet = new Set(updates.map((u) => u.slug));
  for (const u of jsonUpdates) {
    if (!slugSet.has(u.slug)) {
      updates.push(u);
      slugSet.add(u.slug);
    }
  }

  console.log(`Total unique updates: ${updates.length}`);

  // Apply
  let applied = 0;
  let errors = 0;

  for (const update of updates) {
    // Force-update regardless of existing citations
    const { error } = await supabase
      .from("herbs")
      .update({ citations: update.citations })
      .eq("slug", update.slug);

    if (error) {
      errors++;
      if (errors <= 5) console.error(`  ❌ ${update.slug}: ${error.message}`);
    } else {
      applied++;
    }
  }

  console.log(`\nDone: ${applied} applied, ${errors} errors`);

  // Verify
  console.log("\n📊 Key herb verification:");
  const keySlugs = [
    "turmeric",
    "ashwagandha",
    "echinacea",
    "ginkgo-biloba",
    "lavender",
    "peppermint",
    "green-tea",
    "milk-thistle",
    "valerian",
  ];
  const { data } = await supabase
    .from("herbs")
    .select("name, slug, citations")
    .in("slug", keySlugs)
    .eq("is_published", true);

  if (data) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const h of data as any[]) {
      const c = h.citations;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pmids = Array.isArray(c)
        ? c.filter((ci: any) => ci.pmid && /^\d+$/.test(String(ci.pmid)))
        : [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      console.log(
        `  ${pmids.length > 0 ? "✅" : "❌"} ${h.name}: ${pmids.length} PMIDs${pmids.length > 0 ? " — " + pmids.map((p: any) => p.pmid).join(", ") : ""}`
      );
    }
  }
}

main().catch(console.error);
