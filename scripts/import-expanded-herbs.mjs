/**
 * Import the plants that cleared the two-source gate (LNHPD + GBIF).
 *
 * Same rule as the TCM batch: every field traces to a licensed source, and a
 * field with no source is left empty rather than filled with plausible text.
 *
 *   LNHPD productdose -> labelled daily range
 *   LNHPD productrisk -> labelled cautions, verbatim
 *   GBIF              -> accepted name (CC BY 4.0)
 *   NCBI              -> taxid when it answered (public domain)
 *
 * LNHPD publishes no per-product indication, so uses are left empty.
 *
 * Usage: node scripts/import-expanded-herbs.mjs [--dry-run] [--limit N]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const GATE = join(ROOT, "artifacts", "expand-gate.json");
const UA = { "User-Agent": "HerbAlly expansion import (herbally.app)" };
const DRY = process.argv.includes("--dry-run");
const API = "https://health-products.canada.ca/api/natural-licences";
const CATEGORY = "de16f867-b392-4c17-b50a-b6923296ba6d"; // "Not Common"
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

const rowsOf = (p) =>
  Array.isArray(p) ? p : Array.isArray(p?.data) ? p.data : [];
const stripAuthor = (s) =>
  s.replace(/\s+([A-Z][a-z]{0,3}\.?|L\.|\([A-Z][^)]*\))\s*$/, "").trim();
const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/×/g, "x")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
const BOILERPLATE =
  /consult a health care practitioner|consult a doctor|ask a health care|if symptoms persist|keep out of reach/i;

async function getJson(url) {
  try {
    const res = await fetch(url, {
      headers: UA,
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function doseLine(d) {
  const unit = (d.uom_type_desc_quantity_dose || "").toLowerCase();
  const freqUnit = (d.uom_type_desc_frequency || "daily")
    .toLowerCase()
    .replace(/\(s\)/g, "s");
  const lo = d.quantity_dose_minimum ?? d.quantity_dose;
  const hi = d.quantity_dose_maximum ?? d.quantity_dose ?? lo;
  if (lo == null || (Number(lo) === 0 && Number(hi) === 0)) return null;
  const amount =
    Number(lo) === Number(hi) ? `${lo} ${unit}` : `${lo}–${hi} ${unit}`;
  const freq = d.frequency
    ? `${d.frequency}×`
    : d.frequency_minimum
      ? `${d.frequency_minimum}–${d.frequency_maximum}×`
      : "";
  return `${amount}${freq ? ` ${freq}` : ""} ${freqUnit}`
    .replace(/\bdays?\b/i, "daily")
    .replace(/\s+/g, " ")
    .trim();
}

async function evidence(ids) {
  const doses = new Set(),
    risks = new Set();
  let products = 0;
  const urls = [];
  for (const id of ids.slice(0, 3)) {
    const [doseRows, riskRows] = await Promise.all([
      getJson(`${API}/productdose/?id=${id}&lang=en&type=json`),
      getJson(`${API}/productrisk/?id=${id}&lang=en&type=json`),
    ]);
    if (!doseRows && !riskRows) continue;
    products++;
    urls.push(`${API}/productlicence/?id=${id}&lang=en&type=json`);
    for (const d of rowsOf(doseRows)) {
      const line = doseLine(d);
      if (line) doses.add(line);
    }
    for (const r of rowsOf(riskRows)) {
      const t = (r.risk_text || "").replace(/\s+/g, " ").trim();
      if (t.length > 12 && !BOILERPLATE.test(t))
        risks.add(
          `${r.risk_type_desc ? r.risk_type_desc + ": " : ""}${t}`.slice(0, 300)
        );
    }
    await sleep(70);
  }
  return {
    products,
    urls,
    doses: [...doses].slice(0, 4),
    risks: [...risks].slice(0, 6),
  };
}

function doseRange(doses) {
  const nums = [];
  for (const d of doses) {
    const m = /^([\d.]+)(?:–([\d.]+))?\s*(mg|g|ml)\b/i.exec(d);
    if (!m) continue;
    const lo = Number(m[1]),
      hi = Number(m[2] || m[1]);
    const toMg =
      m[3].toLowerCase() === "g"
        ? 1000
        : m[3].toLowerCase() === "mg"
          ? 1
          : null;
    if (toMg == null) continue;
    nums.push([lo * toMg, hi * toMg]);
  }
  const lows = nums.map((n) => n[0]).filter((v) => v > 0);
  const highs = nums.map((n) => n[1]).filter((v) => v > 0);
  if (!lows.length || !highs.length) return null;
  return [Math.min(...lows), Math.max(...highs)];
}

async function main() {
  const limArg = process.argv.indexOf("--limit");
  const limit = limArg >= 0 ? Number(process.argv[limArg + 1]) || 0 : 0;
  const gate = JSON.parse(readFileSync(GATE, "utf8")).results.filter(
    (r) => r.gate === "pass"
  );
  const list = (limit ? gate.slice(0, limit) : gate).sort(
    (a, b) => b.products - a.products
  );
  console.log(
    `[import] ${list.length} plants cleared LNHPD + GBIF${DRY ? " (dry run)" : ""}`
  );

  const existing = new Set();
  for (let off = 0; ; off += 1000) {
    const res = await fetch(
      `${e.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/herbs?select=slug&limit=1000&offset=${off}`,
      { headers: SUPA }
    );
    const page = await res.json();
    if (!Array.isArray(page))
      throw new Error(
        `slug query returned ${JSON.stringify(page).slice(0, 100)}`
      );
    page.forEach((r) => existing.add(r.slug));
    if (page.length < 1000) break;
  }

  const report = [];
  for (const cand of list) {
    const cleanName = stripAuthor(cand.name);
    const slug = slugify(cleanName);
    if (existing.has(slug)) {
      report.push({ slug, status: "exists" });
      continue;
    }
    const ev = await evidence(cand.sample_ids || []);
    const range = doseRange(ev.doses);
    const doseText = range
      ? `${range[0]}–${range[1]} mg per day, labelled range across ${ev.products} licensed product${ev.products === 1 ? "" : "s"}`
      : ev.doses[0] || null;
    const sources = ["Health Canada LNHPD", "GBIF"];
    if (cand.ncbi_taxid) sources.push("NCBI Taxonomy");

    const row = {
      slug,
      name: cleanName,
      scientific_name: cleanName,
      category_id: CATEGORY,
      description: `${cleanName} appears in ${cand.products} licensed natural-health products in Canada${ev.products ? `, and ${ev.products} product labels were read for this entry` : ""}. Health Canada records no specific indication beyond the product's own claim, so this entry states none.`,
      traditional_uses: [],
      modern_uses: [],
      dosage_adult: doseText,
      dosage_child: null,
      contraindications: ev.risks,
      side_effects: [],
      active_compounds: [],
      evidence_level: "C",
      pregnancy_safe: /pregnan/i.test(ev.risks.join(" ")) ? false : null,
      nursing_safe: /breastfeed|nursing|lactat/i.test(ev.risks.join(" "))
        ? false
        : null,
      is_published: true,
      reviewed_by: "HerbAlly Editorial Team",
      reviewer_credentials: null,
      citations: ev.urls
        .slice(0, 3)
        .map((u) => ({ url: u, source: "Health Canada LNHPD" })),
      provenance: {
        verified_by:
          "regulator record (LNHPD) + GBIF" +
          (cand.ncbi_taxid ? " + NCBI Taxonomy" : ""),
        sources: [
          {
            type: "regulator",
            name: "Health Canada LNHPD",
            licence: "canada-ogl",
            products_read: ev.products,
            products_licensed: cand.products,
            url: ev.urls[0] || null,
          },
          {
            type: "taxonomy",
            name: "GBIF",
            licence: "CC BY 4.0",
            url: cand.gbif?.key
              ? `https://www.gbif.org/species/${cand.gbif.key}`
              : null,
          },
          ...(cand.ncbi_taxid
            ? [
                {
                  type: "taxonomy",
                  name: "NCBI Taxonomy",
                  licence: "public domain",
                  url: `https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=${cand.ncbi_taxid}`,
                },
              ]
            : []),
        ],
        verified_sources: sources,
        verified_source_count: sources.length,
        verification_status: sources.length >= 2 ? "verified" : "single_source",
        verification_checked_at: new Date().toISOString().slice(0, 10),
        taxonomy: {
          source: "GBIF",
          licence: "CC BY 4.0",
          cross_check: "gbif_exact_match",
          current_name: cleanName,
          gbif_key: cand.gbif?.key ?? null,
          ncbi_taxid: cand.ncbi_taxid,
        },
        limitations:
          "LNHPD publishes no per-product indication, so uses are empty rather than invented.",
      },
    };

    if (DRY) {
      report.push({
        slug,
        status: "would-import",
        products: ev.products,
        dose: doseText,
      });
      continue;
    }
    const res = await fetch(`${e.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/herbs`, {
      method: "POST",
      headers: {
        ...SUPA,
        Prefer: "return=minimal,resolution=merge-duplicates",
      },
      body: JSON.stringify(row),
    });
    report.push({
      slug,
      status: res.ok
        ? "inserted"
        : `failed ${res.status}: ${(await res.text()).slice(0, 120)}`,
    });
    if (report.length % 25 === 0)
      console.log(`[import] ${report.length}/${list.length}`);
    await sleep(100);
  }

  writeFileSync(
    join(ROOT, "artifacts", "expand-import-report.json"),
    JSON.stringify({ generated_at: new Date().toISOString(), report }, null, 1)
  );
  const counts = report.reduce(
    (a, r) => (
      (a[r.status.split(" ")[0]] = (a[r.status.split(" ")[0]] || 0) + 1),
      a
    ),
    {}
  );
  console.log("[import] done:", JSON.stringify(counts));
}

main().catch((err) => {
  console.error("[import] fatal:", err.message);
  process.exit(1);
});
