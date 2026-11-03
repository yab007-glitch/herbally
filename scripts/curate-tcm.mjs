/**
 * Curate TCM herbs with a three-source gate.
 *
 * Nothing enters the database on one source's word. A candidate must clear all
 * three, each with a licence that permits commercial reuse:
 *
 *   1. Health Canada LNHPD (Open Government Licence – Canada)
 *      — ≥3 licensed products, and the product purposes must actually invoke
 *        traditional Chinese medicine theory. This is the regulatory anchor.
 *   2. MeSH / NLM (public domain)
 *      — a descriptor must exist for the ingredient, so the entity is a defined
 *        biomedical concept and not a trade name.
 *   3. PubChem (public domain)
 *      — a compound record must resolve, so the herb is chemically identifiable.
 *
 * A candidate missing any one of the three is REJECTED with the reason recorded.
 * The academic TCM databases (TCMSP, ETCM, HERB, TCMID, SymMap) are deliberately
 * excluded: they are free for academic use, not licensed for a commercial site.
 *
 * Usage: node scripts/curate-tcm.mjs [--limit N]
 * Output: artifacts/tcm-curation.json
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CANDIDATES = join(ROOT, "artifacts", "lnhpd-new-candidates.json");
const OUT = join(ROOT, "artifacts", "tcm-curation.json");
const UA = { "User-Agent": "HerbAlly TCM curation (herbally.app)" };

const TCM_RX = /traditional chinese medicine|chinese medicine theory|tcm|中医|中藥|中药/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, tries = 2) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: UA });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === tries - 1) throw err;
      await sleep(600);
    }
  }
}

/** LNHPD productlicence rows come back as {metadata,data} in some builds, bare arrays in others. */
function rows(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

async function lnhpdCheck(candidate) {
  let tcmProducts = 0;
  let sampled = 0;
  const urls = [];
  for (const id of (candidate.sample_ids || []).slice(0, 3)) {
    sampled++;
    try {
      const p = rows(await getJson(`https://health-products.canada.ca/api/natural-licences/productlicence/?id=${id}&lang=en&type=json`))[0];
      if (!p) continue;
      const text = JSON.stringify(p);
      if (TCM_RX.test(text)) {
        tcmProducts++;
        urls.push(`https://health-products.canada.ca/api/natural-licences/productlicence/?id=${id}&lang=en&type=json`);
      }
    } catch {}
    await sleep(120);
  }
  return { products: candidate.products, sampled, tcmProducts, urls };
}

async function meshCheck(name) {
  try {
    const j = await getJson(`https://id.nlm.nih.gov/mesh/lookup/descriptor?label=${encodeURIComponent(name)}&match=contains&limit=3`);
    if (!Array.isArray(j) || !j.length) return { found: false };
    const exact = j.find((x) => x.label.toLowerCase() === name.toLowerCase()) || j[0];
    return { found: true, label: exact.label, id: exact.resource.split("/").pop() };
  } catch {
    return { found: false };
  }
}

async function pubchemCheck(name) {
  try {
    const j = await getJson(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/cids/JSON`);
    const cid = j?.IdentifierList?.CID?.[0];
    return cid ? { found: true, cid } : { found: false };
  } catch {
    return { found: false };
  }
}

async function main() {
  const limit = (() => {
    const i = process.argv.indexOf("--limit");
    return i >= 0 ? Number(process.argv[i + 1]) || 0 : 0;
  })();
  if (!existsSync(CANDIDATES)) throw new Error(`missing ${CANDIDATES}`);
  const list = JSON.parse(readFileSync(CANDIDATES, "utf8")).list;
  const BINOMIAL = /^[A-Z][a-z-]+ [a-z][a-z-]+(\s|$)/;
  const candidates = list
    .filter((c) => c.products >= 3 && BINOMIAL.test(c.name))
    .sort((a, b) => b.products - a.products)
    .slice(0, limit || 60);
  console.log(`[tcm] ${candidates.length} binomial-shaped candidates clearing the LNHPD volume bar (≥3 products)`);

  const results = [];
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const ln = await lnhpdCheck(c);
    const mesh = await meshCheck(c.name);
    const pc = await pubchemCheck(c.name);
    const verdict = ln.tcmProducts > 0 && mesh.found && pc.found ? "accept" : "reject";
    const reasons = [];
    if (!ln.tcmProducts) reasons.push("no TCM-theory product among samples");
    if (!mesh.found) reasons.push("no MeSH descriptor");
    if (!pc.found) reasons.push("no PubChem compound");
    results.push({ name: c.name, products: c.products, lnhpd: ln, mesh, pubchem: pc, verdict, reasons });
    if ((i + 1) % 10 === 0) console.log(`[tcm] ${i + 1}/${candidates.length} | accepted ${results.filter((r) => r.verdict === "accept").length}`);
  }

  const accepted = results.filter((r) => r.verdict === "accept");
  writeFileSync(OUT, JSON.stringify({ generated_at: new Date().toISOString(), rule: "LNHPD + MeSH + PubChem", results }, null, 1));
  console.log(`[tcm] done: ${accepted.length} accepted of ${results.length}`);
  for (const a of accepted.slice(0, 15)) console.log(`  ✓ ${a.name} | ${a.products} products | MeSH ${a.mesh.id} | CID ${a.pubchem.cid}`);
  const reasons = {};
  for (const r of results) for (const x of r.reasons) reasons[x] = (reasons[x] || 0) + 1;
  console.log("[tcm] rejection reasons:", JSON.stringify(reasons));
}

main().catch((err) => {
  console.error("[tcm] fatal:", err.message);
  process.exit(1);
});
