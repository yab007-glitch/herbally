/**
 * Repair FR translation type violations.
 *
 * The translation pipeline wrote bare strings into fields that must be
 * string[] (21 entries across 14 herbs). Those values crash every `.join()`
 * consumer — e.g. herb-schema.tsx dropped the JSON-LD block from those FR
 * pages (HERBALLY-9 / -A / -7).
 *
 * This wraps each offending scalar into a one-element array, which is the
 * correct shape and preserves the translated text verbatim.
 *
 * Usage: node scripts/fix-fr-translation-types.mjs [--apply]
 * Without --apply it is a dry run.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const APPLY = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};

// Must mirror the fields joined in herb-schema.tsx / system-prompt.ts, plus
// common_names which the UI maps over.
const ARRAY_FIELDS = [
  "traditional_uses",
  "modern_uses",
  "contraindications",
  "side_effects",
  "common_names",
  "active_compounds",
];

async function fetchAll() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(
      `${url}/rest/v1/herbs?select=slug,translations&limit=1000&offset=${from}`,
      { headers }
    );
    if (!res.ok) {
      console.error("fetch failed", res.status, await res.text());
      process.exit(1);
    }
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < 1000) break;
  }
  return rows;
}

const rows = await fetchAll();
console.log(
  `Scanned ${rows.length} herbs${APPLY ? "" : " (dry run — pass --apply to write)"}`
);

const fixes = [];
for (const row of rows) {
  const frv = row.translations?.fr;
  if (!frv || typeof frv !== "object") continue;

  const repaired = { ...frv };
  let touched = false;

  for (const field of ARRAY_FIELDS) {
    const v = repaired[field];
    if (v === undefined || v === null || Array.isArray(v)) continue;
    if (typeof v === "string" && v.trim()) {
      repaired[field] = [v.trim()];
      touched = true;
      fixes.push({ slug: row.slug, field, value: v.trim().slice(0, 70) });
    }
  }

  if (touched) {
    row._repaired = {
      ...(row.translations ?? {}),
      fr: repaired,
    };
  }
}

console.log(
  `\n${fixes.length} field(s) to repair across ${new Set(fixes.map((f) => f.slug)).size} herb(s):`
);
for (const f of fixes)
  console.log(`  ${f.slug}.fr.${f.field} → ["${f.value}"]`);

if (!APPLY) {
  console.log("\nDry run complete. Re-run with --apply to write.");
  process.exit(0);
}

let ok = 0;
let failed = 0;
for (const row of rows) {
  if (!row._repaired) continue;
  const res = await fetch(
    `${url}/rest/v1/herbs?slug=eq.${encodeURIComponent(row.slug)}`,
    {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ translations: row._repaired }),
    }
  );
  if (res.ok) {
    ok++;
  } else {
    failed++;
    console.error(`  FAILED ${row.slug}: ${res.status} ${await res.text()}`);
  }
}
console.log(`\nUpdated ${ok} herb(s); ${failed} failure(s).`);
