/**
 * Import the TCM herbs that cleared the three-source gate, with monographs built
 * only from what the licensed sources actually contain.
 *
 * What Health Canada's LNHPD publishes per product:
 *   productpurpose — for TCM products this is one generic sentence ("based on the
 *                    theory of Traditional Chinese Medicine"). It carries NO
 *                    indication, so traditional_uses is left empty. Filling it
 *                    would be invention.
 *   productdose    — structured: amount min/max, unit, frequency. This is real and
 *                    is what the dosage line is derived from.
 *   productrisk    — verbatim cautions and warnings.
 *
 * So each monograph states identity (POWO + NCBI), how many licensed products
 * contain it, the labelled dose range across sampled products, and the labelled
 * warnings. Nothing about TCM energetics (nature, flavour, meridians) is claimed,
 * because no source licensed for commercial use provides it.
 *
 * Usage: node scripts/import-tcm-herbs.mjs [--dry-run]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const GATE = join(ROOT, "data", "tcm-gate-results.json");
const UA = { "User-Agent": "HerbAlly TCM import (herbally.app)" };
const DRY = process.argv.includes("--dry-run");
const TCM_CATEGORY = "de16f867-b392-4c17-b50a-b6923296ba6d";
const API = "https://health-products.canada.ca/api/natural-licences";
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
const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/×/g, "x")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
const GENERIC_PURPOSE =
  /based on the theory of traditional chinese medicine|combination of traditional chinese medicine/i;
const BOILERPLATE =
  /consult a health care practitioner|consult a doctor|ask a health care|if symptoms persist|keep out of reach/i;

async function getJson(url, tries = 2) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: UA });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === tries - 1) return null;
      await sleep(400);
    }
  }
}

function doseLine(d) {
  const unit = (d.uom_type_desc_quantity_dose || "").toLowerCase();
  const freqUnit = (d.uom_type_desc_frequency || "daily")
    .toLowerCase()
    .replace(/\(s\)/g, "s");
  const lo = d.quantity_dose_minimum ?? d.quantity_dose;
  const hi = d.quantity_dose_maximum ?? d.quantity_dose ?? lo;
  if (lo == null || (Number(lo) === 0 && Number(hi) === 0)) return null; // a zero amount is 'unspecified', not a dose
  const amount = lo === hi ? `${lo} ${unit}` : `${lo}–${hi} ${unit}`;
  const freq = d.frequency
    ? `${d.frequency}×`
    : d.frequency_minimum
      ? `${d.frequency_minimum}–${d.frequency_maximum}×`
      : "";
  return `${amount}${freq ? ` ${freq}` : ""} ${freqUnit}`
    .replace(/\s+/g, " ")
    .trim();
}

async function evidence(ids) {
  const doses = new Set(),
    risks = new Set();
  let products = 0;
  const urls = [];
  for (const id of ids.slice(0, 6)) {
    const [purposes, doseRows, riskRows] = await Promise.all([
      getJson(`${API}/productpurpose/?id=${id}&lang=en&type=json`).catch(
        () => null
      ),
      getJson(`${API}/productdose/?id=${id}&lang=en&type=json`).catch(
        () => null
      ),
      getJson(`${API}/productrisk/?id=${id}&lang=en&type=json`).catch(
        () => null
      ),
    ]);
    if (!purposes && !doseRows && !riskRows) continue;
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
    await sleep(80);
  }
  return {
    products,
    urls,
    doses: [...doses].slice(0, 4),
    risks: [...risks].slice(0, 6),
  };
}

function doseRange(doses) {
  // Prefer the widest stated range in mg or g so the page says something concrete.
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
  if (!nums.length) return null;
  // A zero lower bound in LNHPD usually means "unspecified", not "take none".
  // Averaging it into the range would print a dose of 0 mg, so drop zeros.
  const lows = nums.map((n) => n[0]).filter((v) => v > 0);
  const highs = nums.map((n) => n[1]).filter((v) => v > 0);
  if (!lows.length || !highs.length) return null;
  return [Math.min(...lows), Math.max(...highs)];
}

async function main() {
  const gate = JSON.parse(readFileSync(GATE, "utf8"));
  const list = gate.filter((r) => r.gate === "pass");
  console.log(
    `[import-tcm] ${list.length} herbs gated${DRY ? " (dry run)" : ""}`
  );

  const existing = new Set();
  for (let off = 0; ; off += 1000) {
    const res = await fetch(
      `${e.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/herbs?select=slug&limit=1000&offset=${off}`,
      { headers: SUPA }
    );
    const page = await res.json();
    page.forEach((r) => existing.add(r.slug));
    if (page.length < 1000) break;
  }

  const report = [];
  for (const cand of list) {
    const ev = await evidence(cand.sample_ids || []);
    const name = cand.powo;
    const slug = slugify(name);
    if (existing.has(slug)) {
      report.push({ slug, status: "exists" });
      continue;
    }
    const range = doseRange(ev.doses);
    const doseText = range
      ? `${range[0]}–${range[1]} mg per day, labelled range across ${ev.products} licensed product${ev.products === 1 ? "" : "s"}`
      : ev.doses[0] || null;

    const description = [
      `${name} is a botanical used in Traditional Chinese Medicine.`,
      `Health Canada has licensed ${cand.tcm_products} natural health product${cand.tcm_products === 1 ? "" : "s"} containing it${ev.products ? `, and ${ev.products} of their labels were read for this entry` : ""}.`,
      range
        ? `The labelled daily dose across those labels runs from ${range[0]} mg to ${range[1]} mg.`
        : "",
      "The regulator records no specific indication beyond the traditional-medicine basis, so this entry claims none.",
    ]
      .filter(Boolean)
      .join(" ");

    const row = {
      slug,
      name,
      scientific_name: name,
      category_id: TCM_CATEGORY,
      description,
      traditional_uses: [],
      modern_uses: [],
      dosage_adult: doseText,
      dosage_child: null,
      contraindications: ev.risks,
      side_effects: [],
      active_compounds: [],
      evidence_level: "trad",
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
        verified_by: "regulator record (LNHPD) + POWO + NCBI Taxonomy",
        sources: [
          {
            type: "regulator",
            name: "Health Canada LNHPD",
            licence: "canada-ogl",
            products_read: ev.products,
            url: ev.urls[0] || null,
          },
          { type: "taxonomy", name: "Kew POWO", licence: "attribution" },
          {
            type: "taxonomy",
            name: "NCBI Taxonomy",
            licence: "public domain",
            url: `https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=${cand.ncbi_taxid}`,
          },
        ],
        taxonomy: {
          source: "Kew POWO",
          licence: "attribution",
          cross_check: "powo_adjudicated",
          corroborated_by: ["NCBI"],
          current_name: name,
          ncbi_taxid: cand.ncbi_taxid,
          tcm_products: cand.tcm_products,
          checked_at: new Date().toISOString().slice(0, 10),
        },
        limitations:
          "LNHPD publishes no per-product indication for TCM licences and no TCM energetics (nature, flavour, meridians). Those fields are deliberately empty rather than filled from an unlicensed source.",
      },
    };

    if (DRY) {
      report.push({
        slug,
        status: "would-import",
        products: ev.products,
        doses: ev.doses.length,
        risks: ev.risks.length,
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
        : `failed ${res.status}: ${(await res.text()).slice(0, 140)}`,
    });
    if (report.length % 10 === 0)
      console.log(`[import-tcm] ${report.length}/${list.length}`);
    await sleep(120);
  }

  writeFileSync(
    join(ROOT, "artifacts", "tcm-import-report.json"),
    JSON.stringify({ generated_at: new Date().toISOString(), report }, null, 1)
  );
  const counts = report.reduce(
    (a, r) => (
      (a[r.status.split(" ")[0]] = (a[r.status.split(" ")[0]] || 0) + 1),
      a
    ),
    {}
  );
  console.log("[import-tcm] done:", JSON.stringify(counts));
  if (DRY)
    for (const r of report.slice(0, 6)) console.log("  ", JSON.stringify(r));
}

main().catch((err) => {
  console.error("[import-tcm] fatal:", err.message);
  process.exit(1);
});
