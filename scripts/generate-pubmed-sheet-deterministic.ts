#!/usr/bin/env tsx
/**
 * generate-pubmed-sheet-deterministic — compile a PubMed information sheet
 * WITHOUT any LLM. Real sentences are lifted directly from PubMed abstract
 * (structured "Conclusions"/"Results" sections where present) and grouped by
 * MeSH condition. Every line is cited [PMID]. No synthesis, no AI, no API cost.
 *
 * Usage:
 *   npx tsx scripts/generate-pubmed-sheet-deterministic.ts <slug> [--max 80] [--out file.json]
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NCBI_API_KEY (optional).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

function getMaxAbstracts(): number {
  const i = process.argv.indexOf("--max");
  if (i >= 0 && process.argv[i + 1]) {
    const n = Number(process.argv[i + 1]);
    return Number.isFinite(n) ? n : 80;
  }
  return 80;
}
const MAX_ABSTRACTS = getMaxAbstracts();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars (.env.local).");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function ncbiParams(extra: Record<string, string>) {
  const p = new URLSearchParams(extra);
  const k = process.env.NCBI_API_KEY;
  if (k) p.set("api_key", k);
  return p;
}

async function fetchHerb(slug: string) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("herbs")
    .select("slug,name,scientific_name,common_names")
    .eq("slug", slug)
    .single();
  if (error || !data) return null;
  return data as {
    slug: string;
    name: string;
    scientific_name: string;
    common_names: string[] | null;
  };
}

async function esearch(term: string): Promise<string[]> {
  const url = `${EUTILS}/esearch.fcgi?${ncbiParams({
    db: "pubmed",
    term,
    retmax: "300",
    retmode: "json",
    sort: "relevance",
  })}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "HerbAlly/1.0 (research; contact: info@herbally.app)",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`esearch HTTP ${res.status}`);
  const j = await res.json();
  return (j?.esearchresult?.idlist ?? []) as string[];
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/<[^>]+>/g, "");
}

interface Section {
  label: string;
  text: string;
}
interface Article {
  pmid: string;
  title: string;
  journal: string;
  year: string | null;
  pubtypes: string[];
  mesh: string[];
  sections: Section[];
  abstract: string;
}

function parseArticles(xml: string): Article[] {
  const blocks = xml.split(/<\/PubmedArticle>/);
  const out: Article[] = [];
  for (const b of blocks) {
    const pmid = b.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1];
    if (!pmid) continue;
    const title = decode(
      b.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/)?.[1] ?? ""
    ).trim();
    const journal = decode(
      b.match(/<Title>([\s\S]*?)<\/Title>/)?.[1] ?? ""
    ).trim();
    const year =
      b.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/)?.[1] ??
      b.match(/<MedlineDate>[\s\S]*?(\d{4})<\/MedlineDate>/)?.[1] ??
      null;
    const pubtypes: string[] = [];
    const reP = /<PublicationType[^>]*>([\s\S]*?)<\/PublicationType>/g;
    let m: RegExpExecArray | null;
    while ((m = reP.exec(b))) pubtypes.push(decode(m[1]).trim());
    const mesh: string[] = [];
    const reM = /<DescriptorName[^>]*>([\s\S]*?)<\/DescriptorName>/g;
    while ((m = reM.exec(b))) mesh.push(decode(m[1]).trim());
    // Abstract sections, preserving the NLM Label attribute.
    const sections: Section[] = [];
    const reA =
      /<AbstractText\s+Label="([^"]*)"[^>]*>([\s\S]*?)<\/AbstractText>|<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g;
    while ((m = reA.exec(b))) {
      const label = (m[1] || "UNLABELLED").trim();
      const text = decode(m[2] ?? m[3] ?? "").trim();
      if (text) sections.push({ label, text });
    }
    const abstract = sections
      .map((s) => s.text)
      .join(" ")
      .trim();
    if (abstract || title) {
      out.push({
        pmid,
        title,
        journal,
        year,
        pubtypes,
        mesh,
        sections,
        abstract,
      });
    }
  }
  return out;
}

async function efetchAbstracts(ids: string[]): Promise<Article[]> {
  if (ids.length === 0) return [];
  const url = `${EUTILS}/efetch.fcgi?${ncbiParams({
    db: "pubmed",
    id: ids.join(","),
    rettype: "abstract",
    retmode: "xml",
  })}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "HerbAlly/1.0 (research; contact: info@herbally.app)",
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`efetch HTTP ${res.status}`);
  return parseArticles(await res.text());
}

function evidenceLevel(pubtypes: string[]): "A" | "B" | "C" | "D" {
  const t = pubtypes.map((p) => p.toLowerCase());
  if (
    t.some(
      (p) => p.includes("meta-analysis") || p.includes("systematic review")
    )
  )
    return "A";
  if (t.some((p) => p.includes("randomized") || p.includes("clinical trial")))
    return "B";
  if (t.some((p) => p.includes("review"))) return "C";
  return "D";
}

function conclusions(a: Article): string {
  const c = a.sections.find((s) => /conclusion/i.test(s.label));
  if (c) return c.text;
  // Fallback: last 1-2 sentences of the abstract.
  const sents = a.abstract.split(/(?<=[.])\s+/).filter(Boolean);
  return sents.slice(-2).join(" ");
}

function pickSentence(text: string, maxChars = 320): string {
  const sents = text.split(/(?<=[.])\s+/).filter(Boolean);
  let out = "";
  for (const s of sents) {
    if ((out + " " + s).trim().length > maxChars) break;
    out = (out + " " + s).trim();
  }
  return out || text.slice(0, maxChars);
}

function buildSearchTerm(herb: {
  scientific_name: string;
  name: string;
  common_names: string[] | null;
}): string {
  const names = [herb.scientific_name, herb.name, ...(herb.common_names ?? [])]
    .map((n) => n.trim())
    .filter(Boolean)
    .filter((n, i, a) => a.indexOf(n) === i);
  return names.map((n) => `"${n}"[Title/Abstract]`).join(" OR ");
}

// MeSH "Disease" or symptom/condition descriptors tend to be capitalized
// common nouns; we approximate condition grouping by the MeSH descriptors that
// appear most often and look like conditions.
const CONDITION_HINTS = [
  "anxiety",
  "depression",
  "stress",
  "sleep",
  "insomnia",
  "pain",
  "inflammation",
  "diabetes",
  "cancer",
  "cardiovascular",
  "cholesterol",
  "lipid",
  "hypertension",
  "cognitive",
  "memory",
  "alzheimer",
  "arthritis",
  "oxidative",
  "antioxidant",
  "antimicrobial",
  "viral",
  "herpes",
  "gastrointestinal",
  "digest",
  "liver",
  "hepat",
  "kidney",
  "renal",
  "skin",
  "wound",
  "metabolic",
  "obesity",
  "weight",
  "immune",
  "immunomod",
];

function conditionOf(a: Article): string | null {
  const hay = (
    a.mesh.join(" ") +
    " " +
    a.title +
    " " +
    a.abstract
  ).toLowerCase();
  for (const c of CONDITION_HINTS) if (hay.includes(c)) return c;
  return null;
}

function buildSheet(
  herb: { name: string; scientific_name: string },
  articles: Article[]
) {
  // Sort articles by evidence strength, then recency.
  const order = { A: 0, B: 1, C: 2, D: 3 };
  const sorted = [...articles].sort(
    (a, b) =>
      order[evidenceLevel(a.pubtypes)] - order[evidenceLevel(b.pubtypes)] ||
      Number(b.year ?? 0) - Number(a.year ?? 0)
  );

  const cite = (pmids: string[]) => pmids.map((p) => `[PMID:${p}]`).join(" ");

  // Summary: highest-evidence conclusions.
  const top = sorted[0];
  const summary = top
    ? `${pickSentence(conclusions(top))} ${cite([top.pmid])}`
    : "No PubMed data available.";

  // Background: most recent review's first sentence.
  const review =
    sorted.find((a) => /review/i.test(a.pubtypes.join(" "))) ?? sorted[0];
  const background = review
    ? `${pickSentence(review.sections.find((s) => /background|objective|purpose/i.test(s.label))?.text ?? review.abstract)} ${cite([review.pmid])}`
    : "No PubMed data available.";

  // Clinical evidence grouped by condition.
  const byCond = new Map<string, Article[]>();
  for (const a of sorted) {
    const c = conditionOf(a);
    if (!c) continue;
    (byCond.get(c) ?? byCond.set(c, []).get(c)!).push(a);
  }
  const clinicalEvidence = Array.from(byCond.entries())
    .slice(0, 10)
    .map(([cond, list]) => {
      const best = list[0];
      return {
        condition: cond[0].toUpperCase() + cond.slice(1),
        finding: `${pickSentence(conclusions(best))} ${cite([best.pmid])}`,
        evidenceLevel: evidenceLevel(best.pubtypes),
        pmids: [best.pmid],
      };
    });

  // Safety: articles about adverse effects / toxicity.
  const safetyArts = sorted.filter((a) => {
    const h = (
      a.mesh.join(" ") +
      " " +
      a.title +
      " " +
      a.abstract
    ).toLowerCase();
    return /adverse|toxic|hepatotox|side effect|safety|poison|overdose/.test(h);
  });
  const safetyAndAdverseEffects = safetyArts.length
    ? safetyArts
        .slice(0, 3)
        .map((a) => `${pickSentence(conclusions(a))} ${cite([a.pmid])}`)
        .join(" ")
    : "No PubMed data available.";

  const pregArts = sorted.filter((a) =>
    /pregnan|lactat|breastfeed|galact|fetal|teratogen/.test(
      (a.mesh.join(" ") + " " + a.abstract).toLowerCase()
    )
  );
  const pregnancyAndLactation = pregArts.length
    ? pregArts
        .slice(0, 2)
        .map((a) => `${pickSentence(conclusions(a))} ${cite([a.pmid])}`)
        .join(" ")
    : "No PubMed data available.";

  const interArts = sorted.filter((a) =>
    /interact|cytochrome|cyp |inhibitor|potentiat/.test(
      (a.mesh.join(" ") + " " + a.abstract).toLowerCase()
    )
  );
  const drugInteractions = interArts.length
    ? interArts
        .slice(0, 2)
        .map((a) => `${pickSentence(conclusions(a))} ${cite([a.pmid])}`)
        .join(" ")
    : "No PubMed data available.";

  const doseArts = sorted.filter((a) =>
    /\b(dose|dosage|mg\/|mg |milligram|daily dose)\b/.test(
      a.abstract.toLowerCase()
    )
  );
  const dosageAndAdministration = doseArts.length
    ? doseArts
        .slice(0, 2)
        .map((a) => `${pickSentence(conclusions(a))} ${cite([a.pmid])}`)
        .join(" ")
    : "No PubMed data available. Consult a healthcare provider.";

  // Evidence summary: counts by publication type.
  const counts: Record<string, number> = {};
  for (const a of articles) {
    const lvl = evidenceLevel(a.pubtypes);
    counts[lvl] = (counts[lvl] ?? 0) + 1;
  }
  const evidenceSummary = `Based on ${articles.length} PubMed articles. By study type: ${Object.entries(
    counts
  )
    .map(([k, v]) => `${k}=${v}`)
    .join(
      ", "
    )} (A=meta-analysis/systematic review, B=RCT/clinical trial, C=review, D=other). All statements are quoted from PubMed abstracts; no AI synthesis was used.`;

  return {
    title: `${herb.name} — PubMed-Compiled Information Sheet (deterministic)`,
    compilationMethod:
      "deterministic (no AI): real PubMed abstract sentences grouped by MeSH condition",
    summary,
    background,
    traditionalUses: "No PubMed data available.",
    activeCompounds: "No PubMed data available.",
    mechanismOfAction: "No PubMed data available.",
    clinicalEvidence,
    safetyAndAdverseEffects,
    pregnancyAndLactation,
    drugInteractions,
    dosageAndAdministration,
    evidenceSummary,
    citedPmids: Array.from(new Set(sorted.map((a) => a.pmid))),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const slug = args[0];
  const outIdx = args.indexOf("--out");
  const outPath = outIdx >= 0 ? args[outIdx + 1] : null;
  if (!slug) {
    console.error(
      "Usage: npx tsx scripts/generate-pubmed-sheet-deterministic.ts <slug> [--max 80] [--out file.json]"
    );
    process.exit(1);
  }
  const herb = await fetchHerb(slug);
  if (!herb) {
    console.error(`Herb not found: ${slug}`);
    process.exit(1);
  }
  const term = buildSearchTerm(herb);
  console.log(`Herb: ${herb.name} (${herb.scientific_name})`);
  const ids = await esearch(term);
  console.log(`esearch: ${ids.length} results`);
  if (ids.length === 0) {
    console.error("No PubMed results.");
    process.exit(2);
  }
  await sleep(340);
  const articles = await efetchAbstracts(ids.slice(0, MAX_ABSTRACTS));
  console.log(`efetch: ${articles.length} abstracts`);
  if (articles.length === 0) {
    console.error("No abstracts.");
    process.exit(2);
  }
  const sheet = buildSheet(herb, articles);
  const citations = articles.map((a) => ({
    pmid: a.pmid,
    title: a.title,
    journal: a.journal,
    year: a.year,
    pubtype: a.pubtypes,
    url: `https://pubmed.ncbi.nlm.nih.gov/${a.pmid}/`,
    evidenceLevel: evidenceLevel(a.pubtypes),
  }));
  const record = {
    slug: herb.slug,
    content: sheet,
    citations,
    pmids: sheet.citedPmids,
    article_count: articles.length,
    model: "deterministic",
    generated_at: new Date().toISOString(),
    status: "compiled",
  };
  const json = JSON.stringify(record, null, 2);
  if (outPath) {
    writeFileSync(outPath, json);
    console.log(`Sheet written to ${outPath}`);
  } else console.log(json);
  console.log(
    `\nSummary: ${articles.length} PubMed abstracts · ${sheet.citedPmids.length} cited (deterministic)`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
