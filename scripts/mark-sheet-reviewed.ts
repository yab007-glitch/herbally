#!/usr/bin/env tsx
/**
 * mark-sheet-reviewed — flip a PubMed-compiled sheet (or many) to "reviewed".
 *
 * After a reviewer (e.g. Dr. Dawn Wong) verifies a sheet, this stamps
 * herb_pubmed_monographs.status = 'reviewed', last_reviewed = now, and
 * reviewed_by = the reviewer name. The herb page then renders the provenance
 * line as "Reviewed information sheet" instead of "not yet human-reviewed".
 *
 * Usage:
 *   npx tsx scripts/mark-sheet-reviewed.ts <slug> [--reviewer "Dr. Dawn Wong"]
 *   npx tsx scripts/mark-sheet-reviewed.ts <slug> --unreview        # revert to compiled
 *   npx tsx scripts/mark-sheet-reviewed.ts --list-unreviewed [--limit 50]
 *   npx tsx scripts/mark-sheet-reviewed.ts --batch slugs.txt [--reviewer "..."]
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (.env.local).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function mark(slug: string, reviewer: string, unreview: boolean) {
  const sb = getSupabase();
  const patch = unreview
    ? { status: "compiled", last_reviewed: null, reviewed_by: null }
    : {
        status: "reviewed",
        last_reviewed: new Date().toISOString(),
        reviewed_by: reviewer,
      };
  const { error } = await sb
    .from("herb_pubmed_monographs")
    .update(patch)
    .eq("slug", slug);
  if (error) throw new Error(`Update failed for ${slug}: ${error.message}`);
  console.log(
    `✓ ${slug} → ${unreview ? "compiled" : "reviewed by " + reviewer}`
  );
}

async function main() {
  const reviewer = arg("reviewer") ?? "Dr. Dawn Wong";
  const unreview = flag("unreview");

  if (flag("list-unreviewed")) {
    const sb = getSupabase();
    const limit = Number(arg("limit") ?? 50);
    const { data, error } = await sb
      .from("herb_pubmed_monographs")
      .select("slug,article_count,model,generated_at")
      .eq("status", "compiled")
      .order("generated_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    console.log(
      `Unreviewed sheets (${data?.length ?? 0} shown, limit ${limit}):`
    );
    for (const r of (data ?? []) as {
      slug: string;
      article_count: number;
      model: string;
    }[])
      console.log(`  ${r.slug}  (${r.article_count} articles, ${r.model})`);
    return;
  }

  const batchFile = arg("batch");
  if (batchFile) {
    const slugs = readFileSync(batchFile, "utf-8")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    console.log(
      `Batch: ${slugs.length} slugs → ${unreview ? "unreview" : "reviewed by " + reviewer}`
    );
    for (const s of slugs) await mark(s, reviewer, unreview);
    return;
  }

  const slug = process.argv[2];
  if (!slug || slug.startsWith("--")) {
    console.error(
      'Usage:\n  npx tsx scripts/mark-sheet-reviewed.ts <slug> [--reviewer "Name"] [--unreview]\n  npx tsx scripts/mark-sheet-reviewed.ts --list-unreviewed [--limit 50]\n  npx tsx scripts/mark-sheet-reviewed.ts --batch slugs.txt [--reviewer "Name"]'
    );
    process.exit(1);
  }
  await mark(slug, reviewer, unreview);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
