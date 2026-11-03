/**
 * Pass 2 of the Health Canada LNHPD import: turn matched product ids into
 * per-herb evidence — what the licensed products actually claim (purpose),
 * what dose they carry, and what risks they state.
 *
 * Licence: Open Government Licence – Canada (commercial reuse permitted with
 * attribution). Registered in docs/data-source-licences.md as
 * `Health Canada LNHPD` / `canada-ogl`. Every emitted record carries the product
 * id and a source URL, and a record without one is dropped rather than defaulted.
 *
 * Usage:
 *   node scripts/enrich-lnhpd.mjs --limit 20          # proof batch
 *   node scripts/enrich-lnhpd.mjs --only turmeric,ginger
 *   node scripts/enrich-lnhpd.mjs                     # all matched herbs
 *
 * Output: artifacts/lnhpd-enrichment.json (review artifact; nothing is written
 * to Supabase by this script).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const MATCHES = join(ROOT, "artifacts", "lnhpd-matches.json");
const OUT = join(ROOT, "artifacts", "lnhpd-enrichment.json");
const API = "https://health-products.canada.ca/api/natural-licences";
const PRODUCTS_PER_HERB = 3;
const CONCURRENCY = 6;

const ARGS = process.argv.slice(2);
const argVal = (flag) => {
  const i = ARGS.indexOf(flag);
  return i >= 0 ? ARGS[i + 1] : null;
};
const LIMIT = Number(argVal("--limit")) || 0;
const ONLY = (argVal("--only") || "").split(",").filter(Boolean);

const clean = (s) =>
  String(s || "")
    .replace(/\s+/g, " ")
    .trim();

async function getJson(path, attempt = 1) {
  try {
    const res = await fetch(
      `${API}/${path}${path.includes("?") ? "&" : "?"}lang=en&type=json`,
      {
        headers: { "User-Agent": "HerbAlly data importer (herbally.app)" },
      }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    return payload.data ?? payload ?? [];
  } catch (err) {
    if (attempt >= 3) throw err;
    await new Promise((r) => setTimeout(r, 1200 * attempt));
    return getJson(path, attempt + 1);
  }
}

async function enrichHerb(slug, rows) {
  const ids = [...new Set(rows.map((r) => r.lnhpd_id))].slice(
    0,
    PRODUCTS_PER_HERB
  );
  const record = {
    slug,
    products_sampled: ids.length,
    purposes: [],
    doses: [],
    risks: [],
    sources: [],
  };

  for (const id of ids) {
    const [purpose, dose, risk] = await Promise.all([
      getJson(`productpurpose/?id=${id}`).catch(() => []),
      getJson(`productdose/?id=${id}`).catch(() => []),
      getJson(`productrisk/?id=${id}`).catch(() => []),
    ]);

    for (const p of purpose) {
      const text = clean(p.purpose || p.purpose_text);
      if (text && !record.purposes.includes(text)) record.purposes.push(text);
    }
    // productdose returns a bare array (not {data:[...]}), with the amount split
    // across quantity_dose / uom_type_desc_quantity_dose / frequency — there is no
    // free-text dose field, so it has to be assembled.
    for (const d of dose) {
      const qty = Number(d.quantity_dose) || 0;
      const qtyMax = Number(d.quantity_dose_maximum) || 0;
      const unit = clean(d.uom_type_desc_quantity_dose);
      const freq = Number(d.frequency) || 0;
      const freqUnit = clean(d.uom_type_desc_frequency);
      const amount = qtyMax > qty ? `${qty}-${qtyMax}` : `${qty}`;
      const text = [
        unit ? `${amount} ${unit}` : null,
        freq ? `${freq}x ${freqUnit || "daily"}` : null,
      ]
        .filter(Boolean)
        .join(" / ");
      if (!text) continue;
      const population = clean(d.population_type_desc) || null;
      if (
        !record.doses.some(
          (x) => x.text === text && x.population === population
        )
      ) {
        record.doses.push({
          text,
          population,
          age_minimum: d.age_minimum ?? null,
        });
      }
    }
    for (const r of risk) {
      const text = clean(r.risk || r.risk_text || r.description);
      if (text && !record.risks.includes(text)) record.risks.push(text);
      else
        for (const key of ["contraindication", "warning", "caution"]) {
          const t = clean(r[key]);
          if (t && !record.risks.includes(t)) record.risks.push(t);
        }
    }
    record.sources.push(`${API}/productlicence/?id=${id}&lang=en&type=json`);
  }

  record.retrieved_at = new Date().toISOString();
  record.source = "Health Canada LNHPD";
  record.source_licence = "canada-ogl";
  return record;
}

async function main() {
  if (!existsSync(MATCHES)) {
    throw new Error(`missing ${MATCHES} — run scripts/harvest-lnhpd.mjs first`);
  }
  const matches = JSON.parse(readFileSync(MATCHES, "utf8")).matches;
  let slugs = Object.keys(matches);
  if (ONLY.length) slugs = slugs.filter((s) => ONLY.includes(s));
  if (LIMIT) slugs = slugs.slice(0, LIMIT);

  const existing = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
  const out = existing.herbs ? existing.herbs : {};
  console.log(
    `[enrich] ${slugs.length} herbs to process (${Object.keys(out).length} already done)`
  );

  let done = 0;
  const queue = [...slugs];
  async function worker() {
    while (queue.length) {
      const slug = queue.shift();
      if (out[slug]?.purposes?.length) continue;
      try {
        out[slug] = await enrichHerb(slug, matches[slug]);
      } catch (err) {
        console.error(`[enrich] ${slug} failed: ${err.message}`);
      }
      done += 1;
      if (done % 20 === 0) {
        writeFileSync(
          OUT,
          JSON.stringify(
            { generated_at: new Date().toISOString(), herbs: out },
            null,
            1
          )
        );
        console.log(
          `[enrich] ${done}/${slugs.length} processed | with purpose text: ${Object.values(out).filter((h) => h.purposes?.length).length}`
        );
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  writeFileSync(
    OUT,
    JSON.stringify(
      { generated_at: new Date().toISOString(), herbs: out },
      null,
      1
    )
  );
  const withPurpose = Object.values(out).filter(
    (h) => h.purposes?.length
  ).length;
  const withDose = Object.values(out).filter((h) => h.doses?.length).length;
  const withRisk = Object.values(out).filter((h) => h.risks?.length).length;
  console.log(
    `[enrich] done. herbs=${Object.keys(out).length} | purpose=${withPurpose} dose=${withDose} risk=${withRisk} -> ${OUT}`
  );
}

main().catch((e) => {
  console.error("[enrich] fatal:", e.message);
  process.exit(1);
});
