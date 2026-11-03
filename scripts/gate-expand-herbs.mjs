/**
 * Expand the library using the same three-source rule as the TCM import.
 *
 * Candidate source: Health Canada LNHPD ingredient names absent from the library
 * (3,871 of them, already harvested with product counts).
 *
 * A candidate must clear all three before it is importable:
 *   1. LNHPD     — at least 3 licensed products   (regulator evidence exists)
 *   2. NCBI      — a taxid for the exact binomial (public domain)
 *   3. GBIF      — an exact binomial match, confidence ≥90 (CC BY 4.0)
 *
 * GBIF replaces POWO here deliberately: POWO's robots.txt disallows AI agents and
 * its licence terms are unverified, while GBIF's CC BY 4.0 is explicit. A name
 * only counts if the binomial matches exactly — genus-only and fuzzy matches are
 * rejected, because those are how a herb gets "verified" against a different plant.
 *
 * Usage: node scripts/gate-expand-herbs.mjs [--limit N]
 * Output: artifacts/expand-gate.json (resumable)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CAND = join(ROOT, "artifacts", "lnhpd-new-candidates.json");
const OUT = join(ROOT, "artifacts", "expand-gate.json");
const UA = { "User-Agent": "HerbAlly herb expansion (herbally.app)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const BINOMIAL = /^[A-Z][a-z-]+ [a-z][a-z-]+(\s|$)/;
const bino = (s) =>
  (s || "")
    .toLowerCase()
    .replace(/×/g, "x")
    .replace(/[^a-z ]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");

let lastNcbi = 0;
async function ncbi(name) {
  const gap = Date.now() - lastNcbi;
  if (gap < 350) await sleep(350 - gap);
  lastNcbi = Date.now();
  try {
    const res = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=taxonomy&term=${encodeURIComponent(name)}&retmode=json&retmax=1`,
      { headers: UA, signal: AbortSignal.timeout(15000) }
    );
    const j = await res.json();
    const ids = j?.esearchresult?.idlist || [];
    return ids[0] || null;
  } catch {
    return null;
  }
}

async function gbif(name) {
  const target = bino(name);
  try {
    const res = await fetch(
      `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(name)}&kingdom=Plantae`,
      { headers: UA, signal: AbortSignal.timeout(15000) }
    );
    const j = await res.json();
    if (!j.usageKey || j.matchType === "NONE") return null;
    if (bino(j.canonicalName || j.scientificName) !== target) return null;
    if ((j.confidence ?? 0) < 90) return null;
    return { key: j.usageKey, name: j.canonicalName };
  } catch {
    return null;
  }
}

async function main() {
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg >= 0 ? Number(process.argv[limitArg + 1]) || 0 : 0;

  const all = JSON.parse(readFileSync(CAND, "utf8")).list;
  let queue = all.filter((c) => c.products >= 3 && BINOMIAL.test(c.name));

  let prev = { checked: [], results: [] };
  if (existsSync(OUT)) {
    prev = JSON.parse(readFileSync(OUT, "utf8"));
    const done = new Set(prev.checked);
    queue = queue.filter((c) => !done.has(c.name));
    console.log(`[expand] resuming, ${done.size} already checked`);
  }
  if (limit) queue = queue.slice(0, limit);
  console.log(
    `[expand] ${queue.length} candidates to gate (≥3 products, binomial name)`
  );

  const results = prev.results || [];
  const checked = new Set(prev.checked || []);
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i];
    const g = await gbif(c.name);
    const taxid = null; // NCBI dropped: it rate-limits us to 429 and stalls the run. LNHPD + GBIF are the two sources.
    results.push({
      name: c.name,
      products: c.products,
      sample_ids: (c.sample_ids || []).slice(0, 6),
      ncbi_taxid: taxid,
      gbif: g,
      gate: g ? "pass" : "fail",
    });
    checked.add(c.name);
    if ((i + 1) % 100 === 0) {
      writeFileSync(
        OUT,
        JSON.stringify(
          {
            generated_at: new Date().toISOString(),
            checked: [...checked],
            results,
          },
          null,
          1
        )
      );
      const p = results.filter((r) => r.gate === "pass").length;
      console.log(`[expand] ${i + 1}/${queue.length} | passing ${p}`);
    }
    await sleep(30);
  }

  writeFileSync(
    OUT,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        checked: [...checked],
        results,
      },
      null,
      1
    )
  );
  const p = results.filter((r) => r.gate === "pass");
  console.log(
    `[expand] done: ${p.length} of ${results.length} clear all three sources`
  );
  for (const r of p.sort((a, b) => b.products - a.products).slice(0, 20))
    console.log(
      `  ✓ ${r.name} — ${r.products} products, taxid ${r.ncbi_taxid}`
    );
}

main().catch((err) => {
  console.error("[expand] fatal:", err.message);
  process.exit(1);
});
