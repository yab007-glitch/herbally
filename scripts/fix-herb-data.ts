#!/usr/bin/env tsx
/**
 * fix-herb-data.ts — Automatically fixes data issues found by
 * verify-herb-content.ts:
 *
 *   1. Safety conflicts: pregnancy_safe=true but contraindication mentions
 *      pregnancy → set pregnancy_safe=false (the contraindication is the
 *      authoritative signal; the boolean was set too liberally by the AI).
 *   2. Same for nursing_safe=true with nursing/breastfeeding contraindications.
 *   3. Short PMIDs (6 digits): prefix with "0" to make 7 digits (old PMIDs
 *      can be 7 digits with leading zeros stripped by the JSON parser).
 *   4. Malformed scientific names (JSON strings): extract the Latin binomial.
 *
 * Usage:
 *   npx tsx scripts/fix-herb-data.ts --dry-run   # Preview
 *   npx tsx scripts/fix-herb-data.ts             # Apply
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const PMID_REGEX = /^\d{7,8}$/;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const dryRun = process.argv.includes("--dry-run");

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Fetch all herbs with pagination
  const selectCols =
    "id, name, slug, scientific_name, pregnancy_safe, nursing_safe, contraindications, citations";
  const allHerbs: Array<Record<string, unknown>> = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from("herbs")
      .select(selectCols)
      .eq("is_published", true)
      .order("name")
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error) {
      console.error("Fetch error:", error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    allHerbs.push(...data);
    if (data.length < 1000) break;
    page++;
  }

  process.stdout.write(
    `Processing ${allHerbs.length} herbs (${dryRun ? "DRY RUN" : "LIVE"})...\n\n`
  );

  let fixedSafety = 0;
  let fixedPmid = 0;
  let fixedSciName = 0;
  let skipped = 0;

  for (const herb of allHerbs) {
    const updates: Record<string, unknown> = {};
    const slug = herb.slug as string;

    // 1. Safety conflict: pregnancy_safe=true but contraindication mentions pregnancy
    const contra = (herb.contraindications as string[]) || [];
    if (herb.pregnancy_safe === true) {
      const hasPregContra = contra.some((c) => /pregnan/i.test(c));
      if (hasPregContra) {
        updates.pregnancy_safe = false;
        if (!dryRun) {
          await supabase
            .from("herbs")
            .update({ pregnancy_safe: false })
            .eq("id", herb.id);
        }
        fixedSafety++;
        process.stdout.write(
          `  [safety] ${slug}: pregnancy_safe true→false (contraindication: "${contra.find((c) => /pregnan/i.test(c))}")\n`
        );
      }
    }

    // 2. Safety conflict: nursing_safe=true but contraindication mentions nursing/breastfeeding
    if (herb.nursing_safe === true) {
      const hasNurseContra = contra.some((c) =>
        /nurs|breastfeed|lactat/i.test(c)
      );
      if (hasNurseContra) {
        updates.nursing_safe = false;
        if (!dryRun) {
          await supabase
            .from("herbs")
            .update({ nursing_safe: false })
            .eq("id", herb.id);
        }
        fixedSafety++;
        process.stdout.write(
          `  [safety] ${slug}: nursing_safe true→false (contraindication: "${contra.find((c) => /nurs|breastfeed|lactat/i.test(c))}")\n`
        );
      }
    }

    // 3. Fix short PMIDs (6 digits → pad to 7)
    const citations = herb.citations as Array<{
      pmid?: string;
      url?: string;
    }> | null;
    if (Array.isArray(citations)) {
      let citationsChanged = false;
      const fixedCitations = citations.map((c) => {
        if (
          c.pmid &&
          !PMID_REGEX.test(String(c.pmid)) &&
          /^\d{6}$/.test(String(c.pmid))
        ) {
          citationsChanged = true;
          const padded = "0" + String(c.pmid);
          fixedPmid++;
          process.stdout.write(`  [pmid] ${slug}: PMID ${c.pmid}→${padded}\n`);
          return {
            ...c,
            pmid: padded,
            url: `https://pubmed.ncbi.nlm.nih.gov/${padded}/`,
          };
        }
        return c;
      });
      if (citationsChanged && !dryRun) {
        await supabase
          .from("herbs")
          .update({ citations: fixedCitations })
          .eq("id", herb.id);
      }
    }

    // 4. Fix malformed scientific names (JSON strings, arrays, etc.)
    const sciName = herb.scientific_name as string;
    if (sciName && (sciName.startsWith("{") || sciName.startsWith("["))) {
      // Try to extract a Latin binomial from the JSON-like string
      const match = sciName.match(/[A-Z][a-z]+ [a-z-]+/);
      if (match) {
        if (!dryRun) {
          await supabase
            .from("herbs")
            .update({ scientific_name: match[0] })
            .eq("id", herb.id);
        }
        fixedSciName++;
        process.stdout.write(
          `  [sciname] ${slug}: "${sciName.slice(0, 40)}"→"${match[0]}"\n`
        );
      }
    }

    if (
      Object.keys(updates).length === 0 &&
      !citations?.some(
        (c) =>
          c.pmid &&
          !PMID_REGEX.test(String(c.pmid)) &&
          /^\d{6}$/.test(String(c.pmid))
      )
    ) {
      if (!sciName?.startsWith("{") && !sciName?.startsWith("[")) {
        skipped++;
      }
    }
  }

  process.stdout.write(`\n${dryRun ? "[DRY RUN] " : ""}Summary:\n`);
  process.stdout.write(`  Safety flags fixed:  ${fixedSafety}\n`);
  process.stdout.write(`  PMIDs fixed:         ${fixedPmid}\n`);
  process.stdout.write(`  Scientific names fixed: ${fixedSciName}\n`);
  process.stdout.write(`  Skipped (no issues): ${skipped}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
