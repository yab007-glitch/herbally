/**
 * Discover herbs in Health Canada's LNHPD that HerbAlly does not have.
 *
 * The first harvest only kept rows that matched an existing herb, so anything
 * new was thrown away. This pass collects EVERY distinct medicinal-ingredient
 * name with its product count, then subtracts what the library already covers.
 *
 * It deliberately does not import. A name appearing in product licences is not
 * a herb — the table also carries vitamins, minerals, amino acids, enzymes,
 * probiotics and homeopathic preparations — and importing a bare name would
 * create exactly the thin page this work exists to remove. The output is a
 * ranked candidate list with the count of licensed products behind each name, so
 * a herb is only worth adding when there is regulator text to build a real page
 * from.
 *
 * Output: artifacts/lnhpd-new-candidates.json
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, "artifacts", "lnhpd-new-candidates.json");
const API =
  "https://health-products.canada.ca/api/natural-licences/medicinalingredient/";
const CONCURRENCY = 8;

const norm = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Things that are medicinal ingredients but not herbs. Importing these would
// pollute a botanical library.
const NOT_HERB =
  /\b(vitamin|mineral|acid|zinc|magnesium|calcium|iron|potassium|selenium|chromium|copper|manganese|iodine|biotin|niacin|thiamin|riboflavin|folate|folacin|cyanocobalamin|enzyme|lactase|probiotic|lactobacillus|bifidobacter|homeopath|nosode|tincture of|glucosamine|chondroitin|collagen|melatonin|l-carnitine|coenzyme|omega|fish oil|flax ?seed oil|evening primrose oil)\b/i;

async function fetchPage(page, attempt = 1) {
  try {
    const res = await fetch(`${API}?lang=en&type=json&page=${page}`, {
      headers: { "User-Agent": "HerbAlly data importer (herbally.app)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (attempt >= 3) throw err;
    await new Promise((r) => setTimeout(r, 1500 * attempt));
    return fetchPage(page, attempt + 1);
  }
}

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

async function knownKeys() {
  const e = env();
  const headers = {
    apikey: e.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${e.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
  };
  const keys = new Set();
  for (let off = 0; ; off += 1000) {
    const url = `${e.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/herbs?select=name,scientific_name,common_names&order=slug&limit=1000&offset=${off}`;
    const res = await fetch(url, { headers });
    const page = await res.json();
    for (const r of page) {
      keys.add(norm(r.name));
      keys.add(norm(r.scientific_name));
      for (const c of r.common_names || []) keys.add(norm(c));
    }
    if (page.length < 1000) break;
  }
  return keys;
}

async function main() {
  const known = await knownKeys();
  console.log(`[discover] ${known.size} known name keys in the library`);

  const counts = new Map(); // normalized name -> {name, products:Set}
  let cursor = 1;
  let scanned = 0;
  while (true) {
    const batch = Array.from({ length: CONCURRENCY }, (_, i) => cursor + i);
    const pages = await Promise.all(
      batch.map((p) => fetchPage(p).catch(() => null))
    );
    let advanced = 0;
    for (const payload of pages) {
      if (!payload?.data) break;
      if (payload.data.length === 0) {
        finish();
        return;
      }
      for (const row of payload.data) {
        const key = norm(row.ingredient_name);
        if (!key || key.length < 4) continue;
        if (!counts.has(key))
          counts.set(key, {
            name: row.ingredient_name.trim(),
            products: new Set(),
            sample: [],
          });
        const rec = counts.get(key);
        rec.products.add(row.lnhpd_id);
        // Keep a few product ids so the importer can pull purpose/dose/risk for
        // this name without a second full crawl.
        if (rec.sample.length < 8 && !rec.sample.includes(row.lnhpd_id))
          rec.sample.push(row.lnhpd_id);
      }
      scanned += payload.data.length;
      advanced += 1;
    }
    if (!advanced) {
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }
    cursor += advanced;
    if (cursor % 400 < CONCURRENCY) {
      mkdirSync(dirname(OUT), { recursive: true });
      console.log(
        `[discover] page ${cursor} | scanned ${scanned} | distinct names ${counts.size}`
      );
    }
  }

  function finish() {
    const candidates = [];
    for (const [key, v] of counts) {
      if (known.has(key)) continue;
      if (NOT_HERB.test(v.name)) continue;
      candidates.push({
        name: v.name,
        products: v.products.size,
        normalized: key,
        sample_ids: v.sample,
      });
    }
    candidates.sort((a, b) => b.products - a.products);
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(
      OUT,
      JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          source: "Health Canada LNHPD (Open Government Licence – Canada)",
          scanned_rows: scanned,
          distinct_names: counts.size,
          known_keys: known.size,
          candidates: candidates.length,
          list: candidates,
        },
        null,
        1
      )
    );
    const strong = candidates.filter((c) => c.products >= 3).length;
    console.log(
      `[discover] done. ${candidates.length} unnamed candidates, ${strong} with >=3 licensed products -> ${OUT}`
    );
  }
}

main().catch((err) => {
  console.error("[discover] fatal:", err.message);
  process.exit(1);
});
