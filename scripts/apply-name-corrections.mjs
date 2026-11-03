/**
 * Apply the reviewed herb name corrections in data/herb-name-corrections.json.
 *
 * Dry run by default. `--apply` is the only mode that writes. Every applied
 * entry is re-checked against the live row first: a scientific_name is written
 * only when it still matches the manifest's `ours` value or is already the new
 * name, so a re-run cannot clobber a later edit and is safe to repeat.
 *
 * `display_name_alignments` is the narrow exception for `herbs.name`: the
 * visible label moves only for slugs listed there, even when that slug's
 * scientific_name was corrected in an earlier batch. This is what lets batch 2
 * finish the eight batch-1 display names that still spell the old binomial.
 *
 * That live-row guard is the only safety net. A second-source verdict, including
 * CONTRADICTED, never blocks a reviewed correction: pau-d-arco's batch 1 entry
 * is retired under `superseded` because the live row was already reverted to
 * Handroanthus impetiginosus, which the manifest records; only the batch 2 entry
 * remains in `applied`, where it now reads as "already applied".
 *
 * An applied row whose `provenance.taxonomy.source` is missing also gets a
 * provenance repair built from the manifest: GBIF Backbone Taxonomy, CC BY 4.0,
 * the target as `current_name`, and `entry.ours` as `previous_name`.
 * `verification` is one of:
 *   - corroborated   exact match or corroborated second source
 *   - third_form     different or third-form second source
 *   - contradicted   contradicted second source
 *   - single_source  anything else, including no second source
 * A contradicted second source is recorded but never blocks a reviewed
 * correction. A taxonomy record that already has a source is never overwritten,
 * so a second run reports zero taxonomy updates.
 *
 * Usage:
 *   node scripts/apply-name-corrections.mjs
 *   node scripts/apply-name-corrections.mjs --apply
 *
 * Exit 1 = a guard failed, a write failed, or a post-write read-back disagreed.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const MANIFEST = join(ROOT, "data", "herb-name-corrections.json");
const APPLY = process.argv.includes("--apply");

function env() {
  const out = {};
  for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split(
    "\n"
  )) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const e = env();
const HEAD = {
  apikey: e.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}`,
};
const REST = `${e.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/herbs`;

const TODAY = new Date().toISOString().slice(0, 10);

/** Batch 1 stored its target in `gbif`; batch 2 uses `new_name`. */
const targetName = (entry) => entry.new_name ?? entry.gbif;

function verificationFromVerdict(verdict) {
  const v = String(verdict ?? "")
    .trim()
    .toLowerCase();
  if (v === "exact match" || v === "corroborated") return "corroborated";
  if (v === "different" || v === "third_form" || v.startsWith("third form"))
    return "third_form";
  if (v === "contradicted") return "contradicted";
  return "single_source";
}

/**
 * The manifest carries a second source either on the entry (`ncbi_name`,
 * `taxid`) or in the top-level `ncbi_second_pass` array (`ncbi_name`,
 * `ncbi_taxid`). The entry wins when present; no record at all means null.
 */
function secondSourceRecord(entry, secondPass) {
  if (entry.second_source) {
    return {
      name: entry.second_source.ncbi_name ?? null,
      taxid: entry.second_source.taxid ?? null,
      verdict: entry.second_source.verdict,
    };
  }
  const pass = secondPass.get(entry.slug);
  if (pass) {
    return {
      name: pass.ncbi_name ?? null,
      taxid: pass.ncbi_taxid ?? null,
      verdict: pass.verdict,
    };
  }
  return null;
}

function taxonomyRecord(entry, target, secondPass) {
  const second = secondSourceRecord(entry, secondPass);
  return {
    source: "GBIF Backbone Taxonomy",
    licence: "CC BY 4.0",
    checked_at: TODAY,
    verified_at: TODAY,
    source_url: `https://www.gbif.org/species/search?q=${encodeURIComponent(target)}`,
    current_name: target,
    previous_name: entry.ours,
    verification: verificationFromVerdict(second?.verdict),
    second_source: "NCBI Taxonomy",
    second_source_name: second?.name ?? null,
    second_source_taxid: second?.taxid ?? null,
  };
}

async function getHerb(slug) {
  const res = await fetch(
    `${REST}?slug=eq.${encodeURIComponent(slug)}&select=*`,
    { headers: HEAD }
  );
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length !== 1)
    throw new Error(`expected 1 row for ${slug}, got ${rows?.length}`);
  return rows[0];
}

async function patchHerb(slug, patch) {
  const res = await fetch(`${REST}?slug=eq.${encodeURIComponent(slug)}`, {
    method: "PATCH",
    headers: {
      ...HEAD,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
  if (!res.ok)
    throw new Error(`update ${slug} failed: ${res.status} ${await res.text()}`);
  return res;
}

async function main() {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const applied = manifest.applied || [];
  const alignments = new Map(
    (manifest.display_name_alignments || []).map((a) => [a.slug, a])
  );
  const secondPass = new Map(
    (manifest.ncbi_second_pass || []).map((r) => [r.slug, r])
  );

  console.log(
    `[names] ${applied.length} applied entries, ${alignments.size} display alignments${APPLY ? "" : " (dry run)"}`
  );

  const table = [];
  const touched = [];
  const failures = [];
  let scientificUpdates = 0;
  let displayUpdates = 0;
  let taxonomyUpdates = 0;
  let unchanged = 0;

  for (const entry of applied) {
    const target = targetName(entry);
    if (!target) {
      failures.push(`${entry.slug}: applied entry has no new name`);
      continue;
    }

    const herb = await getHerb(entry.slug);
    const patch = {};
    const intended = { nameTarget: target };
    let guardFailed = false;

    if (herb.scientific_name === target) {
      table.push({
        slug: entry.slug,
        field: "scientific_name",
        before: herb.scientific_name,
        after: target,
        action: "already applied",
      });
      unchanged++;
    } else if (herb.scientific_name === entry.ours) {
      patch.scientific_name = target;
      intended.scientificWritten = true;
      table.push({
        slug: entry.slug,
        field: "scientific_name",
        before: herb.scientific_name,
        after: target,
        action: APPLY ? "update" : "would update",
      });
    } else {
      table.push({
        slug: entry.slug,
        field: "scientific_name",
        before: herb.scientific_name,
        after: target,
        action: "GUARD FAIL: neither ours nor new",
      });
      failures.push(
        `${entry.slug}: scientific_name is ${JSON.stringify(herb.scientific_name)}, expected ${JSON.stringify(entry.ours)} or ${JSON.stringify(target)}`
      );
      guardFailed = true;
    }

    const alignment = alignments.get(entry.slug);
    if (alignment) {
      if (herb.name === alignment.new_name) {
        table.push({
          slug: entry.slug,
          field: "name",
          before: herb.name,
          after: alignment.new_name,
          action: "already applied",
        });
        unchanged++;
      } else if (herb.name === alignment.old_name) {
        patch.name = alignment.new_name;
        intended.nameWritten = true;
        intended.displayTarget = alignment.new_name;
        table.push({
          slug: entry.slug,
          field: "name",
          before: herb.name,
          after: alignment.new_name,
          action: APPLY ? "update" : "would update",
        });
      } else {
        table.push({
          slug: entry.slug,
          field: "name",
          before: herb.name,
          after: alignment.new_name,
          action: "GUARD FAIL: neither old_name nor new_name",
        });
        failures.push(
          `${entry.slug}: name is ${JSON.stringify(herb.name)}, expected ${JSON.stringify(alignment.old_name)} or ${JSON.stringify(alignment.new_name)}`
        );
        guardFailed = true;
      }
    }

    if (guardFailed) continue;

    if (!herb.provenance?.taxonomy?.source) {
      const taxonomy = taxonomyRecord(entry, target, secondPass);
      patch.provenance = { ...(herb.provenance || {}), taxonomy };
      intended.taxonomyWritten = true;
      intended.taxonomyTarget = target;
      table.push({
        slug: entry.slug,
        field: "provenance.taxonomy",
        before: "(none)",
        after: taxonomy.verification,
        action: APPLY ? "update" : "would update",
      });
    }

    if (!Object.keys(patch).length) continue;

    if (APPLY) await patchHerb(entry.slug, patch);
    touched.push({ slug: entry.slug, ...intended });
    if (intended.scientificWritten) scientificUpdates++;
    if (intended.nameWritten) displayUpdates++;
    if (intended.taxonomyWritten) taxonomyUpdates++;
  }

  console.table(table);

  if (APPLY) {
    for (const t of touched) {
      const herb = await getHerb(t.slug);
      if (t.scientificWritten && herb.scientific_name !== t.nameTarget) {
        failures.push(
          `${t.slug}: read-back scientific_name is ${JSON.stringify(herb.scientific_name)}, expected ${JSON.stringify(t.nameTarget)}`
        );
      }
      if (t.nameWritten && herb.name !== t.displayTarget) {
        failures.push(
          `${t.slug}: read-back name is ${JSON.stringify(herb.name)}, expected ${JSON.stringify(t.displayTarget)}`
        );
      }
      if (t.taxonomyWritten && !herb.provenance?.taxonomy?.source) {
        failures.push(
          `${t.slug}: read-back provenance.taxonomy.source is missing`
        );
      }
      if (
        t.taxonomyWritten &&
        herb.provenance?.taxonomy?.current_name !== t.taxonomyTarget
      ) {
        failures.push(
          `${t.slug}: read-back provenance.taxonomy.current_name is ${JSON.stringify(herb.provenance?.taxonomy?.current_name)}, expected ${JSON.stringify(t.taxonomyTarget)}`
        );
      }
    }
  }

  const mode = APPLY ? "applied" : "dry run";
  console.log(
    `[names] ${mode}: ${scientificUpdates} scientific updates, ${displayUpdates} display updates, ${taxonomyUpdates} taxonomy updates, ${unchanged} already applied, ${failures.length} guard failures`
  );

  if (failures.length) {
    console.error(`\n[names] FAIL - ${failures.length} guard failure(s)`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log(
    `[names] OK - every touched row ${APPLY ? "re-read and matched" : "is safe to write"}`
  );
}

main().catch((err) => {
  console.error("[names] fatal:", err.message);
  process.exit(1);
});
