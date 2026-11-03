/**
 * Guard: every change to a herb's scientific name must be sourced.
 *
 * Compares the current table against data/herb-name-baseline.json and fails if a
 * name differs without `provenance.taxonomy` recording where the correction came
 * from. A fact with no source is a rumour with a schema.
 *
 * It also fails when a taxonomy record's `current_name` differs from the row's
 * `scientific_name`, or when a record claims a second source with no
 * `second_source_name` and no `second_source_taxid`.
 *
 * Run after any worker or import touches taxonomy:
 *   node scripts/verify-herb-facts.mjs
 * Exit 1 = unsourced drift or a taxonomy record that misdescribes its row.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  hasCurrentNameDrift,
  hasPhantomSecondSource,
} from "./lib/herb-taxonomy.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const BASELINE = join(ROOT, "data", "herb-name-baseline.json");

function env() {
  const out = {};
  const local = join(ROOT, ".env.local");
  if (existsSync(local)) {
    for (const line of readFileSync(local, "utf8").split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  for (const [key, value] of Object.entries(process.env)) {
    if (out[key] === undefined && value !== undefined) out[key] = value;
  }
  return out;
}

export async function main() {
  const e = env();
  const head = {
    apikey: e.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}`,
  };

  const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
  const rows = [];
  for (let off = 0; ; off += 1000) {
    const url = `${e.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/herbs?select=slug,scientific_name,provenance,is_published&order=slug&limit=1000&offset=${off}`;
    const res = await fetch(url, { headers: head });
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) break;
  }

  const currentNameDrift = [];
  const phantomSecondSource = [];
  for (const row of rows) {
    const tax = row.provenance?.taxonomy;
    if (!tax?.source) continue;
    if (hasCurrentNameDrift(tax, row.scientific_name)) {
      currentNameDrift.push(row);
    }
    if (hasPhantomSecondSource(tax)) {
      phantomSecondSource.push(row);
    }
  }

  const current = new Map(rows.map((r) => [r.slug, r]));
  const changed = [];
  const unsourced = [];

  for (const [slug, before] of Object.entries(baseline)) {
    const now = current.get(slug);
    if (!now) continue; // merged/unpublished rows are expected to disappear
    if (now.scientific_name === before) continue;
    const tax = now.provenance?.taxonomy;
    const record = {
      slug,
      before,
      after: now.scientific_name,
      source: tax?.source || null,
      licence: tax?.licence || null,
    };
    changed.push(record);
    if (!tax?.source) unsourced.push(record);
  }

  console.log(
    `[facts] ${Object.keys(baseline).length} baseline names | ${changed.length} changed | ${unsourced.length} unsourced`
  );
  console.log(
    `[facts] taxonomy: ${currentNameDrift.length} current_name drift | ${phantomSecondSource.length} phantom second sources`
  );
  for (const row of currentNameDrift.slice(0, 20)) {
    console.log(
      `  ✗ ${row.slug}: current_name ${row.provenance.taxonomy.current_name} != scientific_name ${row.scientific_name}`
    );
  }
  for (const row of phantomSecondSource.slice(0, 20)) {
    console.log(
      `  ✗ ${row.slug}: second_source ${JSON.stringify(row.provenance.taxonomy.second_source)} with no second_source_name or second_source_taxid`
    );
  }
  for (const c of changed.slice(0, 30)) {
    console.log(
      `  ${unsourced.includes(c) ? "✗" : "✓"} ${c.slug}: ${c.before} -> ${c.after}${c.source ? ` (${c.source}, ${c.licence})` : " (NO SOURCE)"}`
    );
  }

  if (unsourced.length) {
    console.error(
      `\n[facts] FAIL — ${unsourced.length} name change(s) with no provenance.taxonomy`
    );
  }
  if (currentNameDrift.length || phantomSecondSource.length) {
    console.error(
      `\n[facts] FAIL — ${currentNameDrift.length} taxonomy current_name drift, ${phantomSecondSource.length} phantom second source(s)`
    );
  }
  if (
    !unsourced.length &&
    !currentNameDrift.length &&
    !phantomSecondSource.length
  ) {
    console.log(
      "\n[facts] OK — every changed name carries a source and every taxonomy record matches its row"
    );
  }

  return { rows, currentNameDrift, phantomSecondSource, unsourced, changed };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main()
    .then((result) => {
      if (
        result.unsourced.length ||
        result.currentNameDrift.length ||
        result.phantomSecondSource.length
      ) {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error("[facts] fatal:", err.message);
      process.exit(1);
    });
}
