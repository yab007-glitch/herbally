/**
 * Clean up after the expansion import, and check for same-species duplicates.
 *
 * Three jobs:
 *   1. Name hygiene — "Ginkgo biloba L." carries the botanist's initial, and
 *      "Ligusticum sinense cv. chuanxiong" carries a cultivar tag. Neither belongs
 *      in a taxon name.
 *   2. Dose wording — LNHPD sometimes gives frequency_min == frequency_max, which
 *      produced "3–3× daily"; and a count of 6 needs "capsules", not "capsule".
 *   3. Duplicate detection — the importer deduped on page address (slug), which
 *      cannot see that Brassica oleracea var. italica and Brassica oleracea are the
 *      same species. This groups by the two-word binomial and reports collisions.
 *
 * It reports duplicates rather than deleting: unpublishing a live page is a
 * decision, not a cleanup.
 *
 * Usage: node scripts/cleanup-expanded-herbs.mjs [--apply]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
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
const SUPA = {
  apikey: e.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

const stripCultivar = (s) =>
  s.replace(/\s+cv\.?\s+[A-Za-z0-9'’ -]+$/i, "").trim();
const stripAuthor = (s) =>
  s.replace(/\s+([A-Z][a-z]{0,3}\.|L\.|\([A-Z][^)]*\))\s*$/, "").trim();
const bino = (s) =>
  (s || "")
    .toLowerCase()
    .replace(/×/g, "x")
    .replace(/[^a-z ]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");

function fixDose(text) {
  if (!text) return text;
  let t = text.replace(/(\d+(?:\.\d+)?)–\1×/g, "$1×"); // 3–3× -> 3×
  t = t.replace(/(\d+(?:\.\d+)?)–(\d+(?:\.\d+)?)×/g, (m, a, b) =>
    a === b ? `${a}×` : m
  );
  t = t.replace(/\b1 (capsule|tablet|drop|sachet|spray|serving)s?\b/gi, "1 $1");
  t = t.replace(
    /\b([2-9]|\d{2,}) (capsule|tablet|drop|sachet|spray|serving)\b/gi,
    "$1 $2s"
  );
  return t.replace(/\s+/g, " ").trim();
}

async function main() {
  const rows = [];
  for (let off = 0; ; off += 1000) {
    const res = await fetch(
      `${e.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/herbs?select=slug,name,scientific_name,dosage_adult,provenance,created_at,is_published&order=created_at&limit=1000&offset=${off}`,
      { headers: SUPA }
    );
    const page = await res.json();
    if (!Array.isArray(page))
      throw new Error(
        `herbs query returned ${JSON.stringify(page).slice(0, 120)}`
      );
    rows.push(...page);
    if (page.length < 1000) break;
  }
  console.log(`[cleanup] ${rows.length} rows loaded`);

  const fixes = [];
  for (const r of rows) {
    const before = {
      name: r.name,
      sci: r.scientific_name,
      dose: r.dosage_adult,
    };
    const sci = stripAuthor(stripCultivar(r.scientific_name || ""));
    const name = stripAuthor(stripCultivar(r.name || ""));
    const dose = fixDose(r.dosage_adult);
    if (sci !== before.sci || name !== before.name || dose !== before.dose) {
      fixes.push({ slug: r.slug, before, after: { name, sci, dose } });
    }
  }
  console.log(`[cleanup] ${fixes.length} rows need name or dose fixes`);

  // same-species duplicates
  const bySpecies = new Map();
  for (const r of rows) {
    const k = bino(r.scientific_name);
    if (!k) continue;
    if (!bySpecies.has(k)) bySpecies.set(k, []);
    bySpecies.get(k).push(r);
  }
  // Same species is not the same page: olive leaf and olive oil are different
  // products and both belong. Only flag pairs whose names are also near-identical.
  const similar = (a, b) => {
    const na = a.toLowerCase().replace(/[^a-z ]/g, ""),
      nb = b.toLowerCase().replace(/[^a-z ]/g, "");
    if (na === nb) return true;
    const longer = na.length >= nb.length ? na : nb,
      shorter = na.length >= nb.length ? nb : na;
    return longer.includes(shorter) && shorter.length >= 5;
  };
  const dupes = [...bySpecies.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([species, list]) => [
      species,
      list.filter((r, i) =>
        list.some((o, j) => j !== i && similar(r.name || "", o.name || ""))
      ),
    ])
    .filter(([, list]) => list.length > 1);
  console.log(`[cleanup] ${dupes.length} species appear more than once`);
  const dupeReport = dupes.map(([species, list]) => ({
    species,
    rows: list.map((r) => ({
      slug: r.slug,
      name: r.name,
      scientific_name: r.scientific_name,
      published: r.is_published,
      created_at: r.created_at,
    })),
  }));

  if (APPLY) {
    let ok = 0;
    for (const f of fixes) {
      const body = {};
      if (f.after.name !== f.before.name) body.name = f.after.name;
      if (f.after.sci !== f.before.sci) body.scientific_name = f.after.sci;
      if (f.after.dose !== f.before.dose) body.dosage_adult = f.after.dose;
      const res = await fetch(
        `${e.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/herbs?slug=eq.${encodeURIComponent(f.slug)}`,
        {
          method: "PATCH",
          headers: { ...SUPA, Prefer: "return=minimal" },
          body: JSON.stringify(body),
        }
      );
      if (res.ok) ok++;
    }
    console.log(`[cleanup] applied ${ok} of ${fixes.length} fixes`);
  }

  writeFileSync(
    join(ROOT, "artifacts", "cleanup-report.json"),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        applied: APPLY,
        fixes,
        duplicates: dupeReport,
      },
      null,
      1
    )
  );
  for (const d of dupeReport.slice(0, 12))
    console.log(`  ${d.species}: ${d.rows.map((r) => r.slug).join(", ")}`);
}

main().catch((err) => {
  console.error("[cleanup] fatal:", err.message);
  process.exit(1);
});
