#!/usr/bin/env node
/**
 * Measure how many interaction pairs can be cited from PubMed at a bar strict
 * enough to be worth publishing.
 *
 * Abstract-term matching is not good enough: a paper can mention both the herb and
 * the drug while being about neither's interaction (the pilot matched turmeric to a
 * letrozole trial). This script applies a title-level rule instead —
 *
 *   title contains the drug, AND
 *   title contains an interaction term (interaction|pharmacokinetic|pharmacodynamic|
 *   metabolism|case report|effect of|co-administer)
 *
 * — and reports coverage without writing anything. `--apply` attaches only the
 * records that pass, and marks them as a title-level match rather than a review.
 *
 * Usage: node scripts/cite-interactions.mjs --strict [--apply] [--limit N]
 */
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname;
const env = {};
for (const line of readFileSync(`${ROOT}.env.local`, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const UA = "HerbAlly/1.0 (https://herbally.app)";
const APPLY = process.argv.includes("--apply");
const limArg = process.argv.indexOf("--limit");
const LIMIT = limArg >= 0 ? Number(process.argv[limArg + 1]) || 0 : 0;
const INTERACTION_TERM =
  /interact|pharmacokinet|pharmacodynam|metaboli[sz]|case report|effect of|co-?administ|coadminister|plasma concentration|blood level/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (r.ok) return r.json();
    if (r.status === 429) {
      await sleep(2000 * (i + 1));
      continue;
    }
    throw new Error(`${r.status}`);
  }
  throw new Error("429 after retries");
}

async function esearch(term) {
  const j = await get(
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=5&term=" +
      encodeURIComponent(term)
  );
  return j.esearchresult?.idlist ?? [];
}

async function esummary(ids) {
  if (!ids.length) return {};
  return (await get(
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=" + ids.join(",")
  )).result ?? {};
}

const drugTerm = (n) => String(n || "").replace(/\s*\([^)]*\)\s*$/, "").trim();

async function main() {
  const herbs = [];
  for (let off = 0; ; off += 1000) {
    const r = await fetch(`${BASE}/rest/v1/herbs?select=id,name,scientific_name&limit=1000&offset=${off}`, { headers: H });
    const page = await r.json();
    herbs.push(...page);
    if (page.length < 1000) break;
  }
  const byId = new Map(herbs.map((h) => [h.id, h]));

  const rows = [];
  for (let off = 0; ; off += 500) {
    const r = await fetch(
      `${BASE}/rest/v1/drug_interactions?select=id,herb_id,drug_name&limit=500&offset=${off}`,
      { headers: H }
    );
    const page = await r.json();
    rows.push(...page);
    if (page.length < 500) break;
  }
  const work = LIMIT ? rows.slice(0, LIMIT) : rows;
  console.log(`[cite] ${work.length} pairs, strict title rule, ${APPLY ? "APPLY" : "dry run"}`);

  const report = [];
  for (const row of work) {
    const herb = byId.get(row.herb_id);
    if (!herb) continue;
    const herbName = herb.name || herb.scientific_name;
    const drug = drugTerm(row.drug_name);
    let ids = [];
    try {
      ids = await esearch(`("${herbName}"[Title]) AND ("${drug}"[Title])`);
    } catch (e) {
      report.push({ id: row.id, herb: herbName, drug, status: `search failed: ${e.message}` });
      await sleep(1200);
      continue;
    }
    await sleep(1100);
    if (!ids.length) {
      report.push({ id: row.id, herb: herbName, drug, status: "no title match" });
      continue;
    }
    const sum = await esummary(ids.slice(0, 5));
    await sleep(1100);
    const hit = ids.slice(0, 5).find((i) => INTERACTION_TERM.test(sum[i]?.title || ""));
    if (!hit) {
      report.push({ id: row.id, herb: herbName, drug, status: "title match, not an interaction study" });
      continue;
    }
    const meta = sum[hit];
    const citation = {
      pmid: hit,
      title: String(meta.title || "").replace(/\s+/g, " ").slice(0, 300),
      journal: meta.source || "",
      year: String(meta.pubdate || "").slice(0, 4),
      url: `https://pubmed.ncbi.nlm.nih.gov/${hit}/`,
    };
    if (APPLY) {
      const patch = await fetch(`${BASE}/rest/v1/drug_interactions?id=eq.${row.id}`, {
        method: "PATCH",
        headers: { ...H, Prefer: "return=minimal" },
        body: JSON.stringify({ source: "PubMed", source_url: citation.url, evidence_level: "title-match" }),
      });
      if (!patch.ok) {
        report.push({ id: row.id, herb: herbName, drug, status: `patch ${patch.status}` });
        continue;
      }
    }
    report.push({ id: row.id, herb: herbName, drug, status: "cited", citation });
  }

  const counts = {};
  for (const r of report) counts[r.status] = (counts[r.status] || 0) + 1;
  console.log("[cite] done:", JSON.stringify(counts));
  writeFileSync(
    `${ROOT}artifacts/interaction-citations.json`,
    JSON.stringify({ generated_at: new Date().toISOString(), applied: APPLY, report }, null, 1)
  );
  for (const r of report.filter((x) => x.status === "cited").slice(0, 6)) {
    console.log(`  ${r.herb} + ${r.drug}: ${r.citation.year} ${r.citation.journal} — ${r.citation.title.slice(0, 90)}`);
  }
}

main().catch((e) => {
  console.error("[cite] fatal:", e.message);
  process.exit(1);
});
