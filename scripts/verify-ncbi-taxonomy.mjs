/**
 * Second-source every scientific name in the table against NCBI Taxonomy.
 *
 * GBIF alone is one authority. A name that only one database agrees with is a
 * single-source fact, not a verified one — and one of the 24 corrections already
 * proved that distinction matters (GBIF's Handroanthus impetiginosum vs NCBI's
 * impetiginosus).
 *
 * Resumable: results append to artifacts/ncbi-verify-all.json and already-checked
 * slugs are skipped on restart. E-utilities allows 3 requests/second without a key.
 *
 * Usage: node scripts/verify-ncbi-taxonomy.mjs [--limit N]
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  appendFileSync,
  mkdirSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, "artifacts", "ncbi-verify-all.json");
const PAGE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const UA = { "User-Agent": "HerbAlly taxonomy verification (herbally.app)" };

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
const HEAD = {
  apikey: e.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}`,
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function allHerbs() {
  const rows = [];
  for (let off = 0; ; off += 1000) {
    const res = await fetch(
      `${e.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/herbs?select=slug,scientific_name,is_published&order=slug&limit=1000&offset=${off}`,
      { headers: HEAD }
    );
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

let last = 0;
async function polite() {
  const gap = Date.now() - last;
  if (gap < 340) await sleep(340 - gap);
  last = Date.now();
}

async function ncbi(name) {
  await polite();
  const s = await fetch(
    `${PAGE}/esearch.fcgi?db=taxonomy&term=${encodeURIComponent(name)}&retmode=json&retmax=1`,
    { headers: UA }
  );
  const sj = await s.json();
  const ids = sj?.esearchresult?.idlist || [];
  if (!ids.length) return { taxid: null, name: null };
  await polite();
  const f = await fetch(
    `${PAGE}/efetch.fcgi?db=taxonomy&id=${ids[0]}&retmode=xml`,
    { headers: UA }
  );
  const xml = await f.text();
  const m = /<ScientificName>([^<]+)<\/ScientificName>/.exec(xml);
  return { taxid: ids[0], name: m ? m[1] : null };
}

function verdict(ours, ncbiName) {
  if (!ncbiName) return "unresolved";
  const n = ncbiName.trim().toLowerCase();
  const o = ours.trim().toLowerCase();
  if (n === o) return "confirmed";
  const oBin = o.split(" ").slice(0, 2).join(" ");
  const nBin = n.split(" ").slice(0, 2).join(" ");
  if (oBin === nBin) return "confirmed"; // same taxon, different rank suffix
  if (n.includes(oBin)) return "confirmed_subspecies"; // NCBI nests ours inside a subspecies
  return "differs";
}

async function main() {
  const limit = (() => {
    const i = process.argv.indexOf("--limit");
    return i >= 0 ? Number(process.argv[i + 1]) || 0 : 0;
  })();

  let done = new Set();
  if (existsSync(OUT)) {
    try {
      const prev = JSON.parse(readFileSync(OUT, "utf8"));
      for (const r of prev.results) done.add(r.slug);
      console.log(`[ncbi] resuming, ${done.size} already checked`);
    } catch {}
  }

  let herbs = (await allHerbs()).filter((h) => !done.has(h.slug));
  if (limit) herbs = herbs.slice(0, limit);
  console.log(`[ncbi] ${herbs.length} herbs to check`);

  const results = existsSync(OUT)
    ? JSON.parse(readFileSync(OUT, "utf8")).results
    : [];
  mkdirSync(dirname(OUT), { recursive: true });

  for (let i = 0; i < herbs.length; i++) {
    const h = herbs[i];
    let r;
    try {
      const got = await ncbi(h.scientific_name);
      r = {
        slug: h.slug,
        scientific_name: h.scientific_name,
        taxid: got.taxid,
        ncbi_name: got.name,
        verdict: verdict(h.scientific_name, got.name),
      };
    } catch (err) {
      r = {
        slug: h.slug,
        scientific_name: h.scientific_name,
        error: err.message,
        verdict: "error",
      };
    }
    results.push(r);
    if ((i + 1) % 100 === 0) {
      writeFileSync(
        OUT,
        JSON.stringify(
          {
            generated_at: new Date().toISOString(),
            source: "NCBI Taxonomy (E-utilities)",
            results,
          },
          null,
          1
        )
      );
      const c = results.reduce(
        (a, x) => ((a[x.verdict] = (a[x.verdict] || 0) + 1), a),
        {}
      );
      console.log(`[ncbi] ${i + 1}/${herbs.length}`, JSON.stringify(c));
    }
  }

  writeFileSync(
    OUT,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        source: "NCBI Taxonomy (E-utilities)",
        results,
      },
      null,
      1
    )
  );
  const c = results.reduce(
    (a, x) => ((a[x.verdict] = (a[x.verdict] || 0) + 1), a),
    {}
  );
  console.log("[ncbi] done:", JSON.stringify(c));
}

main().catch((err) => {
  console.error("[ncbi] fatal:", err.message);
  process.exit(1);
});
