/**
 * Find TCM herbs the way the regulator organises them — by product, not by name.
 *
 * The first curation pass failed for a structural reason: it sampled an
 * ingredient's products and asked whether any invoked TCM. An ingredient like
 * Zingiber officinale appears in hundreds of ordinary supplement licences, so the
 * answer was usually no even when TCM products containing it exist.
 *
 * TCM status lives on the PRODUCT (its purpose text), so this scans product
 * licences, keeps the ones whose purpose invokes TCM theory, and maps each back to
 * its medicinal ingredients. The counts that come out are the real TCM evidence
 * per herb.
 *
 * Usage: node scripts/scan-tcm-products.mjs [--max-pages N]
 * Output: artifacts/tcm-products.json (resumable)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, "artifacts", "tcm-products.json");
const UA = { "User-Agent": "HerbAlly TCM curation (herbally.app)" };
const TCM_RX = /traditional chinese medicine|chinese medicine theory|tcm|中医|中藥|中药|ayurved|traditional medicine theory/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: UA });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === tries - 1) throw err;
      await sleep(500 * (i + 1));
    }
  }
}

const rowsOf = (p) => (Array.isArray(p) ? p : Array.isArray(p?.data) ? p.data : []);

async function main() {
  const maxPages = (() => {
    const i = process.argv.indexOf("--max-pages");
    return i >= 0 ? Number(process.argv[i + 1]) || 0 : 0;
  })();

  let state = { generated_at: null, scanned_pages: 0, scanned_products: 0, tcm_products: 0, herbs: {} };
  if (existsSync(OUT)) {
    state = JSON.parse(readFileSync(OUT, "utf8"));
    console.log(`[tcm-scan] resuming at page ${state.scanned_pages}, ${state.tcm_products} TCM products so far`);
  }

  let page = state.scanned_pages;
  const limit = maxPages || 100000;
  for (let n = 0; n < limit; n++) {
    page++;
    let batch;
    try {
      batch = rowsOf(await getJson(`https://health-products.canada.ca/api/natural-licences/productlicence/?lang=en&type=json&page=${page}`));
    } catch (err) {
      console.log(`[tcm-scan] page ${page} failed: ${err.message} — stopping`);
      break;
    }
    if (!batch.length) {
      console.log(`[tcm-scan] page ${page} empty — end of table`);
      break;
    }
    state.scanned_pages = page;
    state.scanned_products += batch.length;

    for (const p of batch) {
      const text = JSON.stringify(p);
      if (!TCM_RX.test(text)) continue;
      state.tcm_products++;
      const id = p.lnhpd_id || p.id;
      if (!id) continue;
      try {
        const ings = rowsOf(await getJson(`https://health-products.canada.ca/api/natural-licences/medicinalingredient/?lang=en&type=json&id=${id}`));
        for (const ing of ings) {
          const name = ing.ingredient_name;
          if (!name) continue;
          const key = name.toLowerCase().trim();
          if (!state.herbs[key]) state.herbs[key] = { name, products: 0, sample_ids: [] };
          state.herbs[key].products++;
          if (state.herbs[key].sample_ids.length < 8) state.herbs[key].sample_ids.push(id);
        }
      } catch {}
      await sleep(60);
    }

    if (page % 25 === 0) {
      writeFileSync(OUT, JSON.stringify({ ...state, generated_at: new Date().toISOString() }, null, 1));
      console.log(`[tcm-scan] page ${page} | products ${state.scanned_products} | tcm ${state.tcm_products} | herbs ${Object.keys(state.herbs).length}`);
    }
    await sleep(80);
  }

  writeFileSync(OUT, JSON.stringify({ ...state, generated_at: new Date().toISOString() }, null, 1));
  const top = Object.values(state.herbs).sort((a, b) => b.products - a.products).slice(0, 20);
  console.log(`[tcm-scan] done: ${state.tcm_products} TCM products, ${Object.keys(state.herbs).length} distinct herbs`);
  for (const h of top) console.log(`  ${h.products.toString().padStart(4)} × ${h.name}`);
}

main().catch((err) => {
  console.error("[tcm-scan] fatal:", err.message);
  process.exit(1);
});
