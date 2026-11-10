/**
 * Content-depth audit for the herb catalogue.
 *
 * Answers one question with numbers instead of adjectives: how much real content
 * does each published herb page carry, and how many pages are thin enough that
 * Google has nothing to rank them for?
 *
 * Read-only. It never writes to the database.
 *
 *   node scripts/audit-content-depth.mjs            # summary
 *   node scripts/audit-content-depth.mjs --json     # machine-readable
 *   node scripts/audit-content-depth.mjs --csv out  # per-herb rows
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or the anon
 * key) — it reads the same env files the app does.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

function loadEnv() {
  const env = { ...process.env };
  for (const file of [".env.local", ".env"]) {
    let text;
    try {
      text = readFileSync(resolve(ROOT, file), "utf8");
    } catch {
      continue;
    }
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("="))
        continue;
      const at = trimmed.indexOf("=");
      const key = trimmed.slice(0, at).trim();
      const value = trimmed
        .slice(at + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      if (!(key in env)) env[key] = value;
    }
  }
  return env;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY."
  );
  process.exit(1);
}

const COLUMNS = [
  "slug",
  "name",
  "scientific_name",
  "common_names",
  "description",
  "traditional_uses",
  "modern_uses",
  "contraindications",
  "side_effects",
  "citations",
  "provenance",
  "dosage_adult",
  "evidence_level",
].join(",");

async function fetchAll() {
  const pageSize = 1000;
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const res = await fetch(
      `${url}/rest/v1/herbs?select=${COLUMNS}&is_published=eq.true&order=slug&limit=${pageSize}&offset=${offset}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < pageSize) return rows;
  }
}

const words = (s) => (s ? s.trim().split(/\s+/).filter(Boolean).length : 0);
const pct = (n, d) => (d === 0 ? "0.0" : ((n / d) * 100).toFixed(1));
const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const rows = await fetchAll();
const depth = rows.map((r) => {
  const provenance = r.provenance || {};
  return {
    slug: r.slug,
    name: r.name,
    scientific_name: r.scientific_name,
    description_words: words(r.description),
    traditional_uses: (r.traditional_uses || []).length,
    modern_uses: (r.modern_uses || []).length,
    contraindications: (r.contraindications || []).length,
    side_effects: (r.side_effects || []).length,
    citations: (r.citations || []).length,
    has_provenance_source:
      Array.isArray(provenance.sources) && provenance.sources.length > 0,
    has_dosage: Boolean((r.dosage_adult || "").trim()),
    evidence_level: r.evidence_level,
  };
});

const total = depth.length;
const desc = depth.map((d) => d.description_words);
const thin20 = depth.filter((d) => d.description_words <= 20).length;
const thin30 = depth.filter((d) => d.description_words <= 30).length;
const noCitations = depth.filter((d) => d.citations === 0).length;
const noProvenance = depth.filter((d) => !d.has_provenance_source).length;
const noDosage = depth.filter((d) => !d.has_dosage).length;

const report = {
  measured_at: new Date().toISOString(),
  published_herbs: total,
  description_words: {
    median: median(desc),
    mean: Number((desc.reduce((a, b) => a + b, 0) / total).toFixed(1)),
    p90: [...desc].sort((a, b) => a - b)[Math.floor(total * 0.9)],
    max: Math.max(...desc),
  },
  thin: { up_to_20_words: thin20, up_to_30_words: thin30 },
  missing: {
    citations: noCitations,
    provenance_source: noProvenance,
    dosage: noDosage,
  },
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const csvAt = process.argv.indexOf("--csv");
if (csvAt !== -1) {
  const out = process.argv[csvAt + 1] || "content-depth.csv";
  const head = Object.keys(depth[0]).join(",");
  const body = depth.map((d) => Object.values(d).join(",")).join("\n");
  writeFileSync(resolve(ROOT, out), `${head}\n${body}\n`);
  console.log(`Wrote ${out} (${total} rows)`);
  process.exit(0);
}

console.log(`Published herbs: ${total}`);
console.log(
  `Description length: median ${report.description_words.median} words, mean ${report.description_words.mean}, p90 ${report.description_words.p90}, max ${report.description_words.max}`
);
console.log(`  ≤ 20 words: ${thin20} (${pct(thin20, total)}%)`);
console.log(`  ≤ 30 words: ${thin30} (${pct(thin30, total)}%)`);
console.log(
  `No citations:        ${noCitations} (${pct(noCitations, total)}%)`
);
console.log(
  `No provenance source:${noProvenance} (${pct(noProvenance, total)}%)`
);
console.log(`No adult dosage:     ${noDosage} (${pct(noDosage, total)}%)`);
