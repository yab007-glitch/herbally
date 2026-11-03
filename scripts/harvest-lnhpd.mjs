/**
 * Harvest regulator-sourced herb data from Health Canada's Licensed Natural
 * Health Products Database (LNHPD).
 *
 * Why this source: the LNHPD API is published under the Open Government
 * Licence – Canada, which permits commercial reuse with attribution. It is a
 * regulator's record of what licensed products actually claim — indications,
 * doses and risk statements — not a curated third-party aggregate. See
 * docs/data-source-licences.md before changing or extending this.
 *
 * Pass 1 (this script): page through `medicinalingredient` and keep only rows
 * whose ingredient name matches a herb we publish. The table holds ~832k rows
 * at 100 per page (~8.3k requests), so the crawl is resumable: progress is
 * written to the artifact every N pages and the loop picks up where it stopped.
 *
 * Usage:
 *   node scripts/harvest-lnhpd.mjs            # resume or start
 *   node scripts/harvest-lnhpd.mjs --reset    # ignore saved cursor
 *   node scripts/harvest-lnhpd.mjs --pages 50 # stop after N pages (smoke test)
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY (from .env.local).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ARTIFACT = join(ROOT, "artifacts", "lnhpd-matches.json");
const API = "https://health-products.canada.ca/api/natural-licences/medicinalingredient/";
const ARGS = process.argv.slice(2);
const RESET = ARGS.includes("--reset");
const PAGE_LIMIT = (() => {
  const i = ARGS.indexOf("--pages");
  return i >= 0 ? Number(ARGS[i + 1]) || 0 : 0;
})();

function env() {
  const text = readFileSync(join(ROOT, ".env.local"), "utf8");
  const out = {};
  for (const line of text.split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const norm = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function loadState() {
  if (RESET || !existsSync(ARTIFACT)) {
    return { startedAt: new Date().toISOString(), page: 1, total: null, matches: {}, scanned: 0 };
  }
  return JSON.parse(readFileSync(ARTIFACT, "utf8"));
}

function saveState(state) {
  mkdirSync(dirname(ARTIFACT), { recursive: true });
  writeFileSync(ARTIFACT, JSON.stringify(state, null, 1));
}

async function loadHerbIndex() {
  const e = env();
  const headers = {
    apikey: e.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${e.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
  };
  // PostgREST caps a response at the project's db-max-rows (1000 here), so a
  // single limit=3000 silently returns the first 1000 rows and the index would
  // miss two thirds of the library. Page with an explicit offset instead.
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const url = `${e.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/herbs?select=slug,name,scientific_name,common_names&is_published=eq.true&order=slug&limit=1000&offset=${offset}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`herbs fetch failed: ${res.status} at offset ${offset}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) break;
  }
  const index = new Map(); // normalized name -> slug[]
  const add = (raw, slug) => {
    const k = norm(raw);
    if (k.length < 4) return; // "aloe", "tea" style keys are too ambiguous
    const list = index.get(k) || [];
    if (!list.includes(slug)) list.push(slug);
    index.set(k, list);
  };
  for (const r of rows) {
    add(r.name, r.slug);
    add(r.scientific_name, r.slug);
    for (const c of r.common_names || []) add(c, r.slug);
  }
  return { index, herbCount: rows.length };
}

async function fetchPage(page, attempt = 1) {
  const url = `${API}?lang=en&type=json&page=${page}`;
  try {
    const res = await fetch(url, {
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

async function main() {
  const state = loadState();
  const { index, herbCount } = await loadHerbIndex();
  console.log(
    `[lnhpd] ${herbCount} published herbs -> ${index.size} lookup keys | resuming at page ${state.page}`
  );

  // Sequential pages ran at ~4 s each — 8.3k pages is 9 hours, which outlives
  // any session that started it. The endpoint serves 100 rows per request
  // regardless of `limit`, so the only lever is concurrency: 8 in flight keeps
  // the crawl under two hours and is a light load for a public API.
  const CONCURRENCY = 8;
  let cursor = state.page;
  const startPage = cursor;

  while (true) {
    const batch = [];
    for (let i = 0; i < CONCURRENCY; i += 1) batch.push(cursor + i);
    const pages = await Promise.all(batch.map((p) => fetchPage(p).catch(() => ({ data: null, page: p }))));

    let advanced = 0;
    for (const payload of pages) {
      const rows = payload?.data;
      if (!rows) break; // failed page: stop this batch and retry from here next round
      if (rows.length === 0) {
        saveState(state);
        console.log(`[lnhpd] end of data at page ${payload.page ?? cursor}`);
        return finish(state);
      }
      const total = payload.metadata?.pagination?.total ?? null;
      if (total && state.total !== total) {
        state.total = total;
        console.log(`[lnhpd] table reports ${total} rows (${Math.ceil(total / 100)} pages)`);
      }

      for (const row of rows) {
        const key = norm(row.ingredient_name);
        const slugs = index.get(key);
        if (!slugs) continue;
        for (const slug of slugs) {
          const bucket = state.matches[slug] || (state.matches[slug] = []);
          if (!bucket.some((m) => m.lnhpd_id === row.lnhpd_id && m.ingredient_name === row.ingredient_name)) {
            bucket.push({
              lnhpd_id: row.lnhpd_id,
              ingredient_name: row.ingredient_name,
              quantity: row.quantity,
              quantity_minimum: row.quantity_minimum,
              potency_unit_of_measure: row.potency_unit_of_measure,
              source_url: `https://health-products.canada.ca/api/natural-licences/medicinalingredient/?id=${row.lnhpd_id}&lang=en&type=json`,
            });
          }
        }
      }
      state.scanned += rows.length;
      advanced += 1;
    }

    if (advanced === 0) {
      console.log(`[lnhpd] batch at page ${cursor} failed entirely, retrying in 5s`);
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }

    cursor += advanced;
    state.page = cursor;
    saveState(state);
    if (cursor % 200 < CONCURRENCY) {
      console.log(
        `[lnhpd] page ${cursor} | scanned ${state.scanned}/${state.total ?? "?"} | herbs matched ${
          Object.keys(state.matches).length
        }`
      );
    }

    if (PAGE_LIMIT && cursor - startPage >= PAGE_LIMIT) {
      console.log(`[lnhpd] stopping (--pages)`);
      break;
    }
  }

  finish(state);
}

function finish(state) {
  saveState(state);
  const matched = Object.keys(state.matches).length;
  console.log(
    `[lnhpd] done. scanned ${state.scanned}/${state.total ?? "?"} | herbs with matches: ${matched} -> ${ARTIFACT}`
  );
}

main().catch((err) => {
  console.error("[lnhpd] fatal:", err);
  process.exit(1);
});
