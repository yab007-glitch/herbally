#!/usr/bin/env node
/**
 * Second pass over interaction pairs that pass 1 could not cite.
 *
 * Pass 1 searched the herb's display name in the paper title. That misses two
 * common cases:
 *   - the paper names the plant botanically (Curcuma longa, not "Turmeric")
 *   - the paper names the drug by its generic (warfarin) while our row says
 *     "Warfarin (Coumadin)"
 *
 * This pass widens the search to scientific name OR common name in
 * title/abstract, keeps the interaction-term requirement, and writes a REVIEW
 * QUEUE rather than attaching anything: an abstract-level match is a lead for a
 * human, not a citation. `--apply-title` attaches only the records where the drug
 * still appears in the title, which is the same bar pass 1 used.
 *
 * Usage: node scripts/cite-interactions-pass2.mjs [--limit N] [--apply-title]
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
const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};
const UA = "HerbAlly/1.0 (https://herbally.app)";
const APPLY_TITLE = process.argv.includes("--apply-title");
const limArg = process.argv.indexOf("--limit");
const LIMIT = limArg >= 0 ? Number(process.argv[limArg + 1]) || 0 : 0;
const INTERACTION_TERM =
  /interact|pharmacokinet|pharmacodynam|metaboli[sz]|case report|effect of|co-?administ|plasma concentration|blood level|serum level/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (r.ok) return r.json();
    if (r.status === 429) {
      await sleep(2500 * (i + 1));
      continue;
    }
    throw new Error(String(r.status));
  }
  throw new Error("429 after retries");
}

const esearch = async (term) =>
  (
    await get(
      "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=5&term=" +
        encodeURIComponent(term)
    )
  ).esearchresult?.idlist ?? [];

const esummary = async (ids) =>
  ids.length
    ? ((
        await get(
          "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=" +
            ids.join(",")
        )
      ).result ?? {})
    : {};

const generic = (n) =>
  String(n || "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();

async function main() {
  const herbs = [];
  for (let off = 0; ; off += 1000) {
    const r = await fetch(
      `${BASE}/rest/v1/herbs?select=id,name,scientific_name&limit=1000&offset=${off}`,
      { headers: H }
    );
    const page = await r.json();
    herbs.push(...page);
    if (page.length < 1000) break;
  }
  const byId = new Map(herbs.map((h) => [h.id, h]));

  const rows = [];
  for (let off = 0; ; off += 500) {
    const r = await fetch(
      `${BASE}/rest/v1/drug_interactions?select=id,herb_id,drug_name,source_url&source_url=is.null&limit=500&offset=${off}`,
      { headers: H }
    );
    const page = await r.json();
    rows.push(...page);
    if (page.length < 500) break;
  }
  const work = LIMIT ? rows.slice(0, LIMIT) : rows;
  console.log(
    `[pass2] ${work.length} uncited pairs${APPLY_TITLE ? " (apply title-level matches)" : " (review queue only)"}`
  );

  const queue = [];
  for (const row of work) {
    const herb = byId.get(row.herb_id);
    if (!herb) continue;
    const names = [herb.scientific_name, herb.name].filter(Boolean);
    const drug = generic(row.drug_name);
    const nameQuery = names.map((n) => `"${n}"[Title/Abstract]`).join(" OR ");
    let ids = [];
    try {
      ids = await esearch(`(${nameQuery}) AND ("${drug}"[Title/Abstract])`);
    } catch (e) {
      queue.push({ id: row.id, status: `search failed: ${e.message}` });
      await sleep(1200);
      continue;
    }
    await sleep(1100);
    if (!ids.length) {
      queue.push({
        id: row.id,
        herb: herb.name,
        scientific: herb.scientific_name,
        drug,
        status: "no record",
      });
      continue;
    }
    const sum = await esummary(ids.slice(0, 5));
    await sleep(1100);
    const candidates = ids
      .slice(0, 5)
      .filter((i) => sum[i])
      .map((i) => ({
        pmid: i,
        title: String(sum[i].title || "")
          .replace(/\s+/g, " ")
          .slice(0, 300),
        journal: sum[i].source || "",
        year: String(sum[i].pubdate || "").slice(0, 4),
        url: `https://pubmed.ncbi.nlm.nih.gov/${i}/`,
        drugInTitle: new RegExp(drug.split(/\s+/)[0], "i").test(
          sum[i].title || ""
        ),
        interactionTerm: INTERACTION_TERM.test(sum[i].title || ""),
      }));
    const titleLevel = candidates.find(
      (c) => c.drugInTitle && c.interactionTerm
    );
    if (titleLevel && APPLY_TITLE) {
      const patch = await fetch(
        `${BASE}/rest/v1/drug_interactions?id=eq.${row.id}`,
        {
          method: "PATCH",
          headers: { ...H, Prefer: "return=minimal" },
          body: JSON.stringify({
            source: "PubMed",
            source_url: titleLevel.url,
            evidence_level: "title-match",
          }),
        }
      );
      queue.push({
        id: row.id,
        herb: herb.name,
        drug,
        status: patch.ok ? "cited" : `patch ${patch.status}`,
        citation: titleLevel,
      });
      continue;
    }
    queue.push({
      id: row.id,
      herb: herb.name,
      scientific: herb.scientific_name,
      drug,
      status: titleLevel
        ? "review — title-level, not applied"
        : candidates.length
          ? "review — abstract only"
          : "no record",
      candidates: candidates.slice(0, 3),
    });
  }

  const counts = {};
  for (const q of queue) counts[q.status] = (counts[q.status] || 0) + 1;
  console.log("[pass2] done:", JSON.stringify(counts));
  writeFileSync(
    `${ROOT}artifacts/interaction-review-queue.json`,
    JSON.stringify(
      { generated_at: new Date().toISOString(), applied: APPLY_TITLE, queue },
      null,
      1
    )
  );
  const sample = queue.filter((q) => q.candidates?.length).slice(0, 5);
  for (const s of sample) {
    console.log(
      `  review: ${s.herb} + ${s.drug} — ${s.candidates[0].year} ${s.candidates[0].journal}: ${s.candidates[0].title.slice(0, 80)}`
    );
  }
}

main().catch((e) => {
  console.error("[pass2] fatal:", e.message);
  process.exit(1);
});
