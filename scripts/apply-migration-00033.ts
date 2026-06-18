/**
 * Apply migration 00033 — dual safety flags.
 * Adds oral/topical safety columns and backfills data.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
// import * as fs from "fs"; // unused

config({ path: ".env.local" });
config({ path: ".env" });

const KNOWN_EXCEPTIONS: Record<
  string,
  { po: boolean; pt: boolean; no: boolean; nt: boolean }
> = {
  "aloe-vera": { po: false, pt: true, no: false, nt: true },
  arnica: { po: false, pt: true, no: false, nt: true },
  comfrey: { po: false, pt: true, no: false, nt: true },
  "tea-tree": { po: false, pt: true, no: false, nt: true },
  "witch-hazel": { po: false, pt: true, no: false, nt: true },
  cayenne: { po: false, pt: true, no: false, nt: true },
  eucalyptus: { po: false, pt: true, no: false, nt: true },
  "shea-butter": { po: false, pt: true, no: false, nt: true },
  jojoba: { po: false, pt: true, no: false, nt: true },
  rosehip: { po: false, pt: true, no: false, nt: true },
  centella: { po: false, pt: true, no: false, nt: true },
  butterbur: { po: false, pt: false, no: false, nt: false },
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing creds");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log("Applying dual safety flags...");

  // Get all herbs
  const herbList: Array<{
    id: string;
    slug: string;
    pregnancy_safe: boolean | null;
    nursing_safe: boolean | null;
  }> = [];
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from("herbs")
      .select("id, slug, pregnancy_safe, nursing_safe")
      .eq("is_published", true)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    herbList.push(...(data as any[]));
    if (data.length < 1000) break;
    page++;
  }

  console.log(`Updating ${herbList.length} herbs...`);
  let updated = 0;
  let exceptions = 0;

  for (const herb of herbList) {
    const exception = KNOWN_EXCEPTIONS[herb.slug];

    if (exception) {
      const { error } = await supabase
        .from("herbs")
        .update({
          pregnancy_safe_oral: exception.po,
          pregnancy_safe_topical: exception.pt,
          nursing_safe_oral: exception.no,
          nursing_safe_topical: exception.nt,
        })
        .eq("id", herb.id);

      if (!error) exceptions++;
      if (error && exceptions <= 3)
        console.error(`  ❌ ${herb.slug}: ${error.message}`);
    } else {
      // Default: copy existing flags to both routes
      const { error } = await supabase
        .from("herbs")
        .update({
          pregnancy_safe_oral: herb.pregnancy_safe,
          pregnancy_safe_topical: herb.pregnancy_safe,
          nursing_safe_oral: herb.nursing_safe,
          nursing_safe_topical: herb.nursing_safe,
        })
        .eq("id", herb.id);

      if (!error) updated++;
      if (error && updated <= 3)
        console.error(`  ❌ ${herb.slug}: ${error.message}`);
    }

    if ((updated + exceptions) % 200 === 0) {
      console.log(`  ${updated + exceptions}/${herbList.length}`);
    }
  }

  console.log(`\n✅ Updated: ${updated} default + ${exceptions} exceptions`);

  // Verify Aloe Vera
  const { data: aloe } = await supabase
    .from("herbs")
    .select(
      "name, pregnancy_safe_oral, pregnancy_safe_topical, nursing_safe_oral, nursing_safe_topical"
    )
    .eq("slug", "aloe-vera")
    .single();

  if (aloe) {
    console.log(`\n📊 Aloe Vera verification:`);
    console.log(
      `  Pregnancy oral: ${aloe.pregnancy_safe_oral}, topical: ${aloe.pregnancy_safe_topical}`
    );
    console.log(
      `  Nursing oral: ${aloe.nursing_safe_oral}, topical: ${aloe.nursing_safe_topical}`
    );
  }
}

main().catch(console.error);
