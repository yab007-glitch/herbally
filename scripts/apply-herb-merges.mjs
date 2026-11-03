/**
 * Merge duplicate herb records into one canonical page.
 *
 * Each entry is a reviewed decision, not a heuristic: `from` is unpublished and
 * 301s to `to`, after anything genuinely unique (alternate names, citations, a
 * missing dose or contraindication, one distinctive sentence) is carried over.
 *
 * The duplicate is never deleted. `is_published = false` keeps the row, its
 * history and its redirect intact, and the merge is reversible.
 *
 * Usage:
 *   node scripts/apply-herb-merges.mjs --dry-run
 *   node scripts/apply-herb-merges.mjs
 *   node scripts/apply-herb-merges.mjs --manifest path/to/file.json
 *
 * Writes data/herb-merge-redirects.json, which next.config.ts turns into 301s.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DEFAULT_MANIFEST = join(ROOT, "data", "herb-merges.json");
const REDIRECTS_OUT = join(ROOT, "data", "herb-merge-redirects.json");
const DRY = process.argv.includes("--dry-run");
const argVal = (f) => {
  const i = process.argv.indexOf(f);
  return i >= 0 ? process.argv[i + 1] : null;
};
const MANIFEST = argVal("--manifest") || DEFAULT_MANIFEST;

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

const uniq = (arr) => [...new Set((arr || []).filter(Boolean))];

async function mergeOne({ from, to, carry_note }) {
  const [src, dst] = await Promise.all([getHerb(from), getHerb(to)]);

  const commonNames = uniq([
    ...(dst.common_names || []),
    src.name,
    ...(src.common_names || []),
  ])
    .filter((n) => n.toLowerCase() !== (dst.name || "").toLowerCase())
    .slice(0, 12);

  const srcCites = Array.isArray(src.citations) ? src.citations : [];
  const dstCites = Array.isArray(dst.citations) ? dst.citations : [];
  const citeKey = (c) => (typeof c === "string" ? c : JSON.stringify(c));
  const seen = new Set(dstCites.map(citeKey));
  const citations = [
    ...dstCites,
    ...srcCites.filter((c) => !seen.has(citeKey(c))),
  ];

  const patch = {
    common_names: commonNames,
    citations,
  };
  // Only fill fields the canonical record is missing; never overwrite content
  // that already exists, because that is how the good page becomes the worse one.
  for (const field of [
    "dosage_adult",
    "dosage_child",
    "contraindications",
    "side_effects",
    "preparation_notes",
  ]) {
    if (!dst[field] || (Array.isArray(dst[field]) && dst[field].length === 0)) {
      if (src[field] && (!Array.isArray(src[field]) || src[field].length))
        patch[field] = src[field];
    }
  }
  if (carry_note) {
    const base = (dst.description || "").trim();
    if (!base.toLowerCase().includes(carry_note.toLowerCase().slice(0, 40))) {
      patch.description = `${base}${base ? " " : ""}${carry_note}`.trim();
    }
  }

  if (DRY) {
    console.log(
      `[dry] ${from} -> ${to} | +names:${commonNames.length - (dst.common_names || []).length} +cites:${citations.length - dstCites.length} fields:${Object.keys(patch).join(",")}`
    );
    return { from, to };
  }

  const upd = await fetch(`${REST}?slug=eq.${encodeURIComponent(to)}`, {
    method: "PATCH",
    headers: {
      ...HEAD,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
  if (!upd.ok)
    throw new Error(`update ${to} failed: ${upd.status} ${await upd.text()}`);

  const unpub = await fetch(`${REST}?slug=eq.${encodeURIComponent(from)}`, {
    method: "PATCH",
    headers: {
      ...HEAD,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      is_published: false,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!unpub.ok)
    throw new Error(
      `unpublish ${from} failed: ${unpub.status} ${await unpub.text()}`
    );

  console.log(`[merge] ${from} -> ${to} (unpublished)`);
  return { from, to };
}

async function main() {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const entries = manifest.merges || manifest;
  console.log(
    `[merge] ${entries.length} reviewed merges from ${MANIFEST}${DRY ? " (dry run)" : ""}`
  );

  const done = [];
  for (const entry of entries) done.push(await mergeOne(entry));

  if (!DRY) {
    const previous = existsSync(REDIRECTS_OUT)
      ? JSON.parse(readFileSync(REDIRECTS_OUT, "utf8"))
      : [];
    const map = new Map(previous.map((r) => [r.from, r.to]));
    for (const d of done) map.set(`/herbs/${d.from}`, `/herbs/${d.to}`);
    const list = [...map].map(([from, to]) => ({ from, to }));
    writeFileSync(REDIRECTS_OUT, JSON.stringify(list, null, 1));
    console.log(
      `[merge] redirects written: ${list.length} -> ${REDIRECTS_OUT}`
    );
  }
}

main().catch((err) => {
  console.error("[merge] fatal:", err.message);
  process.exit(1);
});
