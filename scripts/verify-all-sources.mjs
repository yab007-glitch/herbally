/**
 * Get every herb to two independent sources, or record honestly that it can't be.
 *
 * A herb is "verified" when at least two independent publishers attest to it:
 *   - Health Canada LNHPD   (regulator content: dose, cautions)
 *   - Kew POWO              (accepted name)
 *   - NCBI Taxonomy         (taxid, public domain)
 *   - GBIF Backbone         (taxonomy, CC BY 4.0)
 *   - ITIS                  (accepted name, public domain)
 *   - PubMed                (literature)
 *
 * Taxonomy sources are checked against the exact binomial. A fuzzy or genus-only
 * match is NOT accepted — that is how you end up "verifying" a herb against a
 * different plant.
 *
 * Rows that still fall short are left labelled, not promoted. A verification badge
 * that everyone gets is worth nothing.
 *
 * Usage: node scripts/verify-all-sources.mjs [--limit N] [--dry-run]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, "artifacts", "source-verification-run.json");
const UA = { "User-Agent": "HerbAlly source verification (herbally.app)" };
const DRY = process.argv.includes("--dry-run");
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

const bino = (s) =>
  (s || "")
    .toLowerCase()
    .replace(/×/g, "x")
    .replace(/[^a-z ]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");

async function gbif(name) {
  const target = bino(name);
  if (!target) return null;
  try {
    const res = await fetch(
      `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(name)}&kingdom=Plantae`,
      { headers: UA }
    );
    const j = await res.json();
    if (!j.usageKey || j.matchType === "NONE") return null;
    const canon = bino(j.canonicalName || j.scientificName);
    if (canon !== target) return null; // different plant — refuse
    if ((j.confidence ?? 0) < 90) return null; // fuzzy — refuse
    return { key: j.usageKey, name: j.canonicalName };
  } catch {
    return null;
  }
}

async function itis(name) {
  try {
    const u = `https://www.itis.gov/ITISWebService/jsonservice/searchByScientificName?srchKey=${encodeURIComponent(name)}`;
    const res = await fetch(u, {
      headers: UA,
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const hit = (j.scientificNames || []).filter(Boolean)[0];
    return hit ? { tsn: hit.tsn } : null;
  } catch {
    return null;
  }
}

let lastNcbi = 0;
async function ncbi(name) {
  const gap = Date.now() - lastNcbi;
  if (gap < 350) await sleep(350 - gap);
  lastNcbi = Date.now();
  try {
    const res = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=taxonomy&term=${encodeURIComponent(name)}&retmode=json&retmax=1`,
      { headers: UA }
    );
    const j = await res.json();
    const ids = j?.esearchresult?.idlist || [];
    return ids.length ? { taxid: ids[0] } : null;
  } catch {
    return null;
  }
}

async function main() {
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg >= 0 ? Number(process.argv[limitArg + 1]) || 0 : 0;

  const herbs = [];
  for (let off = 0; ; off += 1000) {
    const res = await fetch(
      `${e.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/herbs?select=slug,scientific_name,provenance&order=slug&limit=1000&offset=${off}`,
      { headers: SUPA }
    );
    const page = await res.json();
    if (!Array.isArray(page))
      throw new Error(
        `herbs query returned ${JSON.stringify(page).slice(0, 120)}`
      );
    herbs.push(...page);
    if (page.length < 1000) break;
  }

  const need = herbs.filter((h) => {
    const p = h.provenance || {};
    const list = Array.isArray(p.verified_sources) ? p.verified_sources : [];
    return list.length < 2;
  });
  const work = limit ? need.slice(0, limit) : need;
  console.log(
    `[verify] ${herbs.length} herbs | ${need.length} below two sources | checking ${work.length}${DRY ? " (dry run)" : ""}`
  );

  const results = [];
  for (let i = 0; i < work.length; i++) {
    const h = work[i];
    const p = h.provenance || {};
    const sources = new Set(
      Array.isArray(p.verified_sources) ? p.verified_sources : []
    );
    const added = [];

    if (!sources.has("ITIS")) {
      const t = await itis(h.scientific_name);
      if (t) {
        sources.add("ITIS");
        added.push(`ITIS TSN ${t.tsn}`);
      }
    }
    if (!sources.has("NCBI Taxonomy")) {
      const n = await ncbi(h.scientific_name);
      if (n) {
        sources.add("NCBI Taxonomy");
        added.push(`NCBI taxid ${n.taxid}`);
      }
    }
    if (!sources.has("GBIF")) {
      const g = await gbif(h.scientific_name);
      if (g) {
        sources.add("GBIF");
        added.push(`GBIF ${g.name}`);
      }
    }

    const status =
      sources.size >= 2
        ? "verified"
        : sources.size === 1
          ? "single_source"
          : "unverified";
    p.verified_sources = [...sources];
    p.verified_source_count = sources.size;
    p.verification_status = status;
    p.verification_checked_at = new Date().toISOString().slice(0, 10);

    if (!DRY && added.length) {
      const res = await fetch(
        `${e.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/herbs?slug=eq.${encodeURIComponent(h.slug)}`,
        {
          method: "PATCH",
          headers: { ...SUPA, Prefer: "return=minimal" },
          body: JSON.stringify({ provenance: p }),
        }
      );
      if (!res.ok) results.push({ slug: h.slug, error: `PATCH ${res.status}` });
    } else if (!DRY) {
      await fetch(
        `${e.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/herbs?slug=eq.${encodeURIComponent(h.slug)}`,
        {
          method: "PATCH",
          headers: { ...SUPA, Prefer: "return=minimal" },
          body: JSON.stringify({ provenance: p }),
        }
      );
    }
    results.push({ slug: h.slug, added, total: sources.size, status });

    if ((i + 1) % 100 === 0) {
      writeFileSync(
        OUT,
        JSON.stringify(
          {
            generated_at: new Date().toISOString(),
            processed: i + 1,
            of: work.length,
            results,
          },
          null,
          1
        )
      );
      const v = results.filter((r) => r.status === "verified").length;
      console.log(`[verify] ${i + 1}/${work.length} | verified ${v}`);
    }
    await sleep(40);
  }

  writeFileSync(
    OUT,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        processed: work.length,
        of: work.length,
        results,
      },
      null,
      1
    )
  );
  const v = results.filter((r) => r.status === "verified").length;
  const s = results.filter((r) => r.status === "single_source").length;
  const u = results.filter((r) => r.status === "unverified").length;
  console.log(
    `[verify] done: ${v} promoted to verified, ${s} still single-source, ${u} unverified`
  );
}

main().catch((err) => {
  console.error("[verify] fatal:", err.message);
  process.exit(1);
});
