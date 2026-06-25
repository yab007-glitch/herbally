#!/usr/bin/env tsx
/**
 * fetch-gov-sources — reviewer-in-the-loop accuracy tool.
 *
 * For a given herb slug, fetches the authoritative government source page
 * (currently NCCIH "Herbs at a Glance", when a direct URL is mapped) and emits
 * a side-by-side diff of the CURRENT database fields vs. the extracted
 * government text, so a reviewer (e.g. Dr. Dawn Wong) can correct the DB row
 * against the credible source.
 *
 * IMPORTANT: this script NEVER writes to the database. It only fetches and
 * prints a reviewer diff. Corrections are applied by a human via
 * mark-herb-provenance.ts / admin after verifying the extracted text.
 *
 * Usage:
 *   npx tsx scripts/fetch-gov-sources.ts <slug>            # print diff to stdout
 *   npx tsx scripts/fetch-gov-sources.ts <slug> --out file.json
 *   npx tsx scripts/fetch-gov-sources.ts --list            # list mapped herbs
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import { getGovSources, hasGovMonograph } from "../src/lib/data/gov-sources";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in .env.local."
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface HerbRow {
  name: string;
  slug: string;
  scientific_name: string;
  description: string | null;
  traditional_uses: string[] | null;
  modern_uses: string[] | null;
  dosage_adult: string | null;
  dosage_child: string | null;
  pregnancy_safe: boolean | null;
  nursing_safe: boolean | null;
  contraindications: string[] | null;
  side_effects: string[] | null;
  evidence_level: string | null;
}

async function fetchHerb(slug: string): Promise<HerbRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("herbs")
    .select(
      "name, slug, scientific_name, description, traditional_uses, modern_uses, dosage_adult, dosage_child, pregnancy_safe, nursing_safe, contraindications, side_effects, evidence_level"
    )
    .eq("slug", slug)
    .single();
  if (error || !data) return null;
  return data as HerbRow;
}

/** Fetch a URL and return cleaned visible text (best-effort). */
async function fetchText(url: string, timeoutMs = 20000): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const html = await res.text();
  return cleanHtml(html);
}

function cleanHtml(html: string): string {
  let t = html;
  // Drop scripts/styles/nav/footer/header.
  t = t.replace(/<script[\s\S]*?<\/script>/gi, " ");
  t = t.replace(/<style[\s\S]*?<\/style>/gi, " ");
  t = t.replace(/<nav[\s\S]*?<\/nav>/gi, " ");
  t = t.replace(/<footer[\s\S]*?<\/footer>/gi, " ");
  t = t.replace(/<header[\s\S]*?<\/header>/gi, " ");
  // Prefer main content if present.
  const main = t.match(/<main[\s\S]*?<\/main>/i);
  if (main) t = main[0];
  // Strip remaining tags.
  t = t.replace(/<[^>]+>/g, " ");
  // Decode a few common entities.
  t = t
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

function buildDiff(
  herb: HerbRow,
  govText: string,
  govSources: ReturnType<typeof getGovSources>
) {
  return {
    herb: {
      slug: herb.slug,
      name: herb.name,
      scientific_name: herb.scientific_name,
    },
    governmentSources: govSources.map((s) => ({
      label: s.label,
      url: s.url,
      kind: s.kind,
      authoritative: s.authoritative,
    })),
    currentDatabaseValues: {
      description: herb.description,
      traditional_uses: herb.traditional_uses,
      modern_uses: herb.modern_uses,
      dosage_adult: herb.dosage_adult,
      dosage_child: herb.dosage_child,
      pregnancy_safe: herb.pregnancy_safe,
      nursing_safe: herb.nursing_safe,
      contraindications: herb.contraindications,
      side_effects: herb.side_effects,
      evidence_level: herb.evidence_level,
    },
    governmentSourceText: govText.slice(0, 20000),
    note: "Review the government source text against the current DB values and correct discrepancies via admin or mark-herb-provenance.ts. This diff is for review only — no database writes were performed.",
  };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--list")) {
    // List herbs that have a direct government monograph mapped.
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("herbs")
      .select("slug, name")
      .eq("is_published", true);
    if (error) throw new Error(error.message);
    const mapped = (data ?? []).filter((h) => hasGovMonograph(h.slug));
    console.log(`Herbs with a direct government monograph (${mapped.length}):`);
    for (const h of mapped) console.log(`  ${h.slug}  —  ${h.name}`);
    return;
  }

  const slug = args[0];
  const outIdx = args.indexOf("--out");
  const outPath = outIdx >= 0 ? args[outIdx + 1] : null;
  if (!slug) {
    console.error(
      "Usage: npx tsx scripts/fetch-gov-sources.ts <slug> [--out file.json]"
    );
    console.error("       npx tsx scripts/fetch-gov-sources.ts --list");
    process.exit(1);
  }

  const herb = await fetchHerb(slug);
  if (!herb) {
    console.error(`Herb not found: ${slug}`);
    process.exit(1);
  }

  const govSources = getGovSources(herb.slug, herb.name);
  const direct = govSources.find((s) => s.kind === "monograph");

  console.log(
    `Herb: ${herb.name} (${herb.scientific_name}) — slug: ${herb.slug}`
  );
  console.log(
    `Government monograph mapped: ${direct ? "yes" : "no (search fallbacks only)"}`
  );
  console.log(`Sources:`);
  for (const s of govSources)
    console.log(`  - [${s.kind}] ${s.label}: ${s.url}`);

  let govText = "";
  if (direct) {
    console.log(`\nFetching ${direct.url} ...`);
    try {
      govText = await fetchText(direct.url);
      console.log(`Fetched ${govText.length} chars of cleaned text.`);
    } catch (e) {
      console.error(`  Fetch failed: ${e instanceof Error ? e.message : e}`);
      govText = `[FETCH FAILED] Could not retrieve ${direct.url}`;
    }
  }

  const diff = buildDiff(herb, govText, govSources);
  const json = JSON.stringify(diff, null, 2);
  if (outPath) {
    writeFileSync(outPath, json);
    console.log(`\nDiff written to ${outPath}`);
  } else {
    console.log("\n--- REVIEWER DIFF (JSON) ---\n");
    console.log(json);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
