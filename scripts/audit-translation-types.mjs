/**
 * Audit: type-check translations.fr and base columns for the .join() crash class.
 * Reads .env.local for Supabase credentials. Never prints secrets.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing env");
  process.exit(1);
}

const ARRAY_FIELDS = [
  "contraindications",
  "side_effects",
  "traditional_uses",
  "modern_uses",
  "common_names",
  "active_compounds",
];

async function fetchAll() {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; from < 5000; from += pageSize) {
    const res = await fetch(
      `${url}/rest/v1/herbs?select=slug,translations,contraindications,side_effects,traditional_uses&limit=${pageSize}&offset=${from}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (!res.ok) {
      console.error("HTTP", res.status, await res.text());
      process.exit(1);
    }
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

function typeOf(v) {
  if (v === null || v === undefined) return "null";
  if (Array.isArray(v)) {
    const bad = v.filter((x) => typeof x !== "string");
    return bad.length ? `array(with ${bad.length} non-string)` : "array";
  }
  return typeof v;
}

const rows = await fetchAll();
console.log(`Fetched ${rows.length} herbs`);

// 1. Confirm the reported herb
const target = rows.find((r) => r.slug === "mentha-longifolia");
if (target) {
  console.log("\n--- mentha-longifolia ---");
  console.log("base contraindications:", typeOf(target.contraindications));
  console.log("base side_effects:", typeOf(target.side_effects));
  const frv = target.translations?.fr;
  if (frv) {
    for (const f of ARRAY_FIELDS) {
      if (frv[f] !== undefined) console.log(`fr.${f}:`, typeOf(frv[f]));
    }
  } else {
    console.log("no fr translations object");
  }
  console.log(
    "fr.contraindications raw sample:",
    JSON.stringify(frv?.contraindications)?.slice(0, 200)
  );
}

// 2. Scan ALL herbs for the bug class
const offenders = { base: [], fr: {} };
for (const r of rows) {
  for (const f of ["contraindications", "side_effects", "traditional_uses"]) {
    const bt = typeOf(r[f]);
    if (bt !== "array" && bt !== "null") {
      offenders.base.push({ slug: r.slug, field: f, type: bt });
    }
  }
  const frv = r.translations?.fr;
  if (frv && typeof frv === "object") {
    for (const f of ARRAY_FIELDS) {
      const v = frv[f];
      if (v === undefined) continue;
      const t = typeOf(v);
      if (t !== "array") {
        (offenders.fr[f] ??= []).push({
          slug: r.slug,
          type: t,
          sample: typeof v === "string" ? v.slice(0, 80) : JSON.stringify(v).slice(0, 80),
        });
      }
    }
  }
}

console.log("\n=== BASE COLUMN TYPE VIOLATIONS ===");
console.log(offenders.base.length ? JSON.stringify(offenders.base, null, 2) : "none");

console.log("\n=== FR TRANSLATION TYPE VIOLATIONS ===");
let frTotal = 0;
for (const [f, list] of Object.entries(offenders.fr)) {
  frTotal += list.length;
  console.log(`\nfr.${f}: ${list.length} offenders`);
  console.log(JSON.stringify(list.slice(0, 40), null, 2));
}
console.log(`\nTOTAL fr violations: ${frTotal}`);
