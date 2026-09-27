/**
 * Quantify the FR schema-loss blast radius: which herbs would crash herb-schema.tsx
 * (and system-prompt.ts) because translations.fr has strings where arrays are expected.
 * Read-only. Never prints secrets.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const rows = [];
for (let from = 0; ; from += 1000) {
  const res = await fetch(
    `${url}/rest/v1/herbs?select=slug,name,translations&limit=1000&offset=${from}`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  const batch = await res.json();
  rows.push(...batch);
  if (batch.length < 1000) break;
}

// Fields consumed with .join() in herb-schema.tsx + system-prompt.ts
const JOINED = [
  "traditional_uses",
  "contraindications",
  "side_effects",
  "active_compounds",
];

const affected = [];
for (const r of rows) {
  const frv = r.translations?.fr;
  if (!frv || typeof frv !== "object") continue;
  const bad = [];
  for (const f of JOINED) {
    const v = frv[f];
    if (v === undefined || v === null) continue;
    if (!Array.isArray(v)) bad.push(`${f} (${typeof v})`);
  }
  if (bad.length) affected.push({ slug: r.slug, name: r.name, bad });
}

console.log(`\n${rows.length} herbs scanned`);
console.log(
  `${affected.length} herbs crash herb-schema.tsx on /fr/herbs/<slug>:\n`
);
for (const a of affected) console.log(`  ${a.slug}  —  ${a.bad.join(", ")}`);
console.log(`\nTotal affected FR pages: ${affected.length}`);
