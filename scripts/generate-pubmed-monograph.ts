#!/usr/bin/env tsx
/**
 * generate-pubmed-monograph — compile a PubMed-grounded information sheet for a
 * herb that has no hand-written monograph.
 *
 * 1. Look up the herb (name, scientific + common names) from Supabase.
 * 2. Search PubMed (NIH/NLM eutils) for the herb.
 * 3. Fetch the top abstracts (metadata + abstract text) via efetch.
 * 4. Ask an Ollama Cloud model to compile a structured monograph using ONLY the
 *    provided abstracts, citing a PMID for every factual claim. Every cited
 *    PMID is validated to exist in the fetched set — invented citations are
 *    stripped.
 * 5. Emit a JSON information sheet (Monograph-shaped) + citations list.
 *
 * Ollama Cloud is a flat-rate subscription (no per-call cost), so the full
 * catalog can be compiled without metered charges. The synthesis is AI-assisted
 * but every claim is backed by a real PubMed article and the source list ships
 * with the sheet. Reviewer-in-the-loop — do not mark authoritative without a
 * human (e.g. Dr. Dawn Wong) review.
 *
 * Usage:
 *   npx tsx scripts/generate-pubmed-monograph.ts <slug> [--out file.json] [--max 80] [--write]
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OLLAMA_CLOUD_API_KEY,
 *      OLLAMA_CLOUD_URL (default https://ollama.com/v1), OLLAMA_CLOUD_MODEL,
 *      PUBMED_COMPILE_MODELS (comma list, default deepseek-v4-pro,glm-5.2,qwen3.5:397b),
 *      NCBI_API_KEY (optional, higher eutils rate).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import { hasManualMonograph } from "../src/lib/data/monographs";

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

const COMPILE_MODELS = (
  process.env.PUBMED_COMPILE_MODELS || "gemma4:31b,glm-5.2,qwen3.5:397b"
)
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

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

interface Herb {
  slug: string;
  name: string;
  scientific_name: string;
  common_names: string[] | null;
}

async function fetchHerb(slug: string): Promise<Herb | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("herbs")
    .select("slug,name,scientific_name,common_names")
    .eq("slug", slug)
    .single();
  if (error || !data) return null;
  return data as Herb;
}

function ncbiParams(extra: Record<string, string>) {
  const p = new URLSearchParams(extra);
  const k = process.env.NCBI_API_KEY;
  if (k) p.set("api_key", k);
  return p;
}

// ── Global eutils rate limiter ─────────────────────────────────────
// NIH eutils enforces ~3 req/s WITHOUT an api key (and returns 429 above it),
// so high worker concurrency must NOT let eutils calls burst. We serialize ALL
// eutils requests through a single gate (≥400ms apart = ~2.5/s) and retry on
// 429/5xx. The Ollama compile (the real bottleneck, ~10-15s) still runs fully
// in parallel across workers — only eutils is throttled.
const EUTILS_MIN_INTERVAL_MS = process.env.NCBI_API_KEY ? 120 : 400;
let eutilsLastAt = 0;
let eutilsChain: Promise<void> = Promise.resolve();

/** Serialize eutils calls so the global rate stays under NIH's limit. */
async function eutilsGate(): Promise<() => void> {
  const prev = eutilsChain;
  let release!: () => void;
  eutilsChain = new Promise<void>((r) => (release = r));
  await prev;
  const elapsed = Date.now() - eutilsLastAt;
  if (elapsed < EUTILS_MIN_INTERVAL_MS) {
    await sleep(EUTILS_MIN_INTERVAL_MS - elapsed);
  }
  eutilsLastAt = Date.now();
  return release;
}

/** Gated + retrying fetch for eutils. */
async function eutilsFetch(url: string, timeoutMs: number): Promise<Response> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const release = await eutilsGate();
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "HerbAlly/1.0 (research; contact: info@herbally.app)",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 429 || res.status >= 500) {
        // Backoff and retry — release the gate so the next call can proceed
        // after the backoff window (rate limit is time-based).
        release();
        await sleep(Math.min(1000 * 2 ** attempt, 15000));
        continue;
      }
      return res;
    } finally {
      release();
    }
  }
  throw new Error(`eutils rate-limited/failed after retries: ${url}`);
}

async function esearch(term: string): Promise<string[]> {
  const url = `${EUTILS}/esearch.fcgi?${ncbiParams({
    db: "pubmed",
    term,
    retmax: "300",
    retmode: "json",
    sort: "relevance",
  })}`;
  const res = await eutilsFetch(url, 20000);
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

interface Article {
  pmid: string;
  title: string;
  abstract: string;
  journal: string;
  year: string | null;
  pubtypes: string[];
  mesh: string[];
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
    const absParts: string[] = [];
    const re = /<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(b))) absParts.push(decode(m[1]).trim());
    const abstract = absParts.join(" ").trim();
    const journal = decode(
      b.match(/<Title>([\s\S]*?)<\/Title>/)?.[1] ?? ""
    ).trim();
    const year =
      b.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/)?.[1] ??
      b.match(/<MedlineDate>[\s\S]*?(\d{4})<\/MedlineDate>/)?.[1] ??
      null;
    const pubtypes: string[] = [];
    const reP = /<PublicationType[^>]*>([\s\S]*?)<\/PublicationType>/g;
    while ((m = reP.exec(b))) pubtypes.push(decode(m[1]).trim());
    const mesh: string[] = [];
    const reM = /<DescriptorName[^>]*>([\s\S]*?)<\/DescriptorName>/g;
    while ((m = reM.exec(b))) mesh.push(decode(m[1]).trim());
    if (abstract || title) {
      out.push({ pmid, title, abstract, journal, year, pubtypes, mesh });
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
  const res = await eutilsFetch(url, 30000);
  if (!res.ok) throw new Error(`efetch HTTP ${res.status}`);
  const xml = await res.text();
  return parseArticles(xml);
}

function evidenceLevel(pubtypes: string[]): "A" | "B" | "C" | "D" | "trad" {
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

function buildSearchTerm(herb: Herb): string {
  const names = [herb.scientific_name, herb.name, ...(herb.common_names ?? [])]
    .map((n) => n.trim())
    .filter(Boolean)
    .filter((n, i, a) => a.indexOf(n) === i);
  return names.map((n) => `"${n}"[Title/Abstract]`).join(" OR ");
}

function buildCompilePrompt(herb: Herb, articles: Article[]): string {
  const articleText = articles
    .map(
      (a) =>
        `[PMID ${a.pmid}] (${a.year ?? "n.d."}) ${a.title}\n` +
        `Journal: ${a.journal} | Type: ${a.pubtypes.join(", ") || "n/a"}\n` +
        `Abstract: ${a.abstract.slice(0, 1000)}`
    )
    .join("\n\n");

  return `You are a medical writer compiling a PubMed-sourced information sheet for a medicinal herb. Use ONLY the PubMed abstracts provided below. Every factual sentence MUST cite one or more PMIDs from the provided set in the form [PMID:12345]. Do NOT invent PMIDs. Do NOT make claims that are not supported by the abstracts. If a section has no supporting abstracts, write exactly: "No PubMed data available." Mark evidence strength by study type (meta-analysis/systematic review = A; RCT/clinical trial = B; review = C; other = D).

HERB: ${herb.name} (${herb.scientific_name})

Return STRICT JSON only (no prose, no markdown) with this shape:
{
  "title": "${herb.name} — PubMed-Compiled Information Sheet",
  "summary": "1-2 sentence overview, cited [PMID:x]",
  "background": "what the herb is, cited",
  "traditionalUses": "string or 'No PubMed data available.' (cite if available)",
  "activeCompounds": "string, cited",
  "mechanismOfAction": "string, cited",
  "clinicalEvidence": [
    {"condition": "string", "finding": "string cited [PMID:x]", "evidenceLevel": "A|B|C|D", "pmids": ["12345"]}
  ],
  "safetyAndAdverseEffects": "string, cited",
  "pregnancyAndLactation": "string, cited or 'No PubMed data available.'",
  "drugInteractions": "string, cited or 'No PubMed data available.'",
  "dosageAndAdministration": "string, cited or 'No PubMed data available. Consult a healthcare provider.'",
  "evidenceSummary": "overall strength of evidence across the studies",
  "citedPmids": ["12345","67890"]
}

PMID ABSTRACTS:
${articleText}`;
}

async function compileSheet(herb: Herb, articles: Article[]) {
  const prompt = buildCompilePrompt(herb, articles);
  const valid = new Set(articles.map((a) => a.pmid));
  const baseUrl = (
    process.env.OLLAMA_CLOUD_URL || "https://ollama.com/v1"
  ).trim();
  const apiKey = process.env.OLLAMA_CLOUD_API_KEY?.trim();
  if (!apiKey)
    throw new Error("OLLAMA_CLOUD_API_KEY not configured (.env.local).");

  // Call Ollama Cloud directly so we can use a generous timeout (compiling
  // ~40 abstracts can take >60s) and capture the reasoning field when present.
  for (const model of COMPILE_MODELS) {
    for (const useJson of [true, false]) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000);
        const res = await fetch(`${baseUrl}/chat/completions`, {
          signal: controller.signal,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content:
                  "You are a meticulous medical writer. Respond ONLY with valid JSON.",
              },
              { role: "user", content: prompt },
            ],
            temperature: 0.2,
            max_tokens: 8000,
            ...(useJson ? { response_format: { type: "json_object" } } : {}),
          }),
        });
        clearTimeout(timeoutId);
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`);
        }
        const data = (await res.json()) as {
          choices?: Array<{
            message?: { content?: string; reasoning?: string };
          }>;
        };
        const msg = data.choices?.[0]?.message;
        const text = msg?.content || msg?.reasoning || "";
        // Strip ```json fences if present.
        const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
        const raw = fenced ? fenced[1] : text;
        const bstart = raw.indexOf("{");
        const bend = raw.lastIndexOf("}");
        if (bstart < 0 || bend <= bstart) {
          console.error(
            `[compile] ${model} useJson=${useJson}: no JSON (len=${text.length})`
          );
          if (text.length) console.error(`  head: ${text.slice(0, 200)}`);
          continue;
        }
        const json = JSON.parse(raw.slice(bstart, bend + 1));
        // Cited PMIDs come from the model's citedPmids field PLUS any PMIDs it
        // cited inline in the prose (e.g. [PMID:12345]). Some models populate
        // the field well (glm-5.2); others cite inline but leave the array
        // empty, so merge both and validate against the fetched set.
        const fieldPmids = Array.isArray(json.citedPmids)
          ? json.citedPmids.map((p: unknown) => String(p))
          : [];
        const inlinePmids: string[] = [];
        const re = /PMID[:\s]*(\d{5,9})/gi;
        let mm: RegExpExecArray | null;
        const prose = JSON.stringify(json);
        while ((mm = re.exec(prose))) inlinePmids.push(mm[1]);
        const citedPmids = Array.from(
          new Set([...fieldPmids, ...inlinePmids])
        ).filter((p: string) => valid.has(p));
        return { sheet: json, citedPmids, model };
      } catch (e) {
        console.error(
          `[compile] ${model} useJson=${useJson} failed: ${
            e instanceof Error ? e.message : e
          }`
        );
      }
    }
  }
  throw new Error(
    "All Ollama Cloud compilation attempts failed. Check OLLAMA_CLOUD_API_KEY / OLLAMA_CLOUD_URL and available models."
  );
}

async function fetchAllHerbs() {
  const sb = getSupabase();
  const all: {
    slug: string;
    name: string;
    scientific_name: string;
    common_names: string[] | null;
  }[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from("herbs")
      .select("slug,name,scientific_name,common_names")
      .eq("is_published", true)
      .order("slug", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...(data as typeof all));
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

async function existingSheetSlugs(): Promise<Set<string>> {
  const sb = getSupabase();
  const set = new Set<string>();
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from("herb_pubmed_monographs")
      .select("slug")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    for (const r of data as { slug: string }[]) set.add(r.slug);
    if (data.length < 1000) break;
    from += 1000;
  }
  return set;
}

async function generateForSlug(
  herb: Herb,
  opts: { write: boolean }
): Promise<{ ok: boolean; cited: number; articles: number; error?: string }> {
  try {
    const term = buildSearchTerm(herb);
    const ids = await esearch(term);
    if (ids.length === 0)
      return { ok: false, cited: 0, articles: 0, error: "no pubmed results" };
    await sleep(340);
    const articles = await efetchAbstracts(ids.slice(0, MAX_ABSTRACTS));
    if (articles.length === 0)
      return { ok: false, cited: 0, articles: 0, error: "no abstracts" };
    const { sheet, citedPmids, model } = await compileSheet(herb, articles);
    const citations = articles
      .filter((a) => citedPmids.includes(a.pmid))
      .map((a) => ({
        pmid: a.pmid,
        title: a.title,
        authors: [] as string[],
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
      pmids: citedPmids,
      article_count: articles.length,
      model,
      generated_at: new Date().toISOString(),
      status: "compiled",
    };
    if (opts.write) {
      const sb = getSupabase();
      const { error } = await sb
        .from("herb_pubmed_monographs")
        .upsert(record, { onConflict: "slug" });
      if (error) throw new Error(`DB upsert failed: ${error.message}`);
    }
    return { ok: true, cited: citedPmids.length, articles: articles.length };
  } catch (e) {
    return {
      ok: false,
      cited: 0,
      articles: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const doWrite = args.includes("--write");
  const isBatch = args.includes("--batch");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : 0;
  const concIdx = args.indexOf("--concurrency");
  const concurrency =
    concIdx >= 0 && Number(args[concIdx + 1]) > 0
      ? Number(args[concIdx + 1])
      : 8;
  const outIdx = args.indexOf("--out");
  const outPath = outIdx >= 0 ? args[outIdx + 1] : null;

  if (isBatch) {
    // Batch mode: generate sheets for every published herb that has no
    // hand-written monograph and no existing sheet. Resumable — already-
    // generated slugs are skipped. Logs a progress line per herb.
    const herbs = await fetchAllHerbs();
    const done = await existingSheetSlugs();
    const todo = herbs.filter(
      (h) => !hasManualMonograph(h.slug) && !done.has(h.slug)
    );
    const n = limit > 0 ? Math.min(limit, todo.length) : todo.length;
    console.log(
      `Batch: ${todo.length} herbs to generate${limit > 0 ? ` (limited to ${n})` : ""}; write=${doWrite}`
    );
    // Worker pool: run `concurrency` herbs in parallel. The bottleneck is the
    // Ollama compile (~10-15s), not eutils, so parallelizing compiles gives a
    // near-linear speedup. Each worker keeps a small eutils sleep so the
    // combined PubMed request rate stays well under NIH's limit without an
    // API key.
    let ok = 0;
    let failed = 0;
    let next = 0;
    const failedList: string[] = [];
    async function worker(workerId: number) {
      while (true) {
        const i = next++;
        if (i >= n) return;
        const herb = todo[i];
        const r = await generateForSlug(herb, { write: doWrite });
        if (r.ok) {
          ok++;
          console.log(
            `[${i + 1}/${n}] ${herb.slug} ok (${r.articles} abstracts, ${r.cited} cited) [w${workerId}]`
          );
        } else {
          failed++;
          failedList.push(`${herb.slug}: ${r.error}`);
          console.log(
            `[${i + 1}/${n}] ${herb.slug} FAIL (${r.error}) [w${workerId}]`
          );
        }
      }
    }
    const workers = Array.from({ length: concurrency }, (_, k) =>
      worker(k + 1)
    );
    await Promise.all(workers);
    console.log(`\nBatch done: ${ok} ok, ${failed} failed of ${n}.`);
    if (failedList.length) {
      console.log("Failed:\n  " + failedList.join("\n  "));
    }
    return;
  }

  const slug = args[0];
  if (!slug) {
    console.error(
      "Usage:\n  npx tsx scripts/generate-pubmed-monograph.ts <slug> [--out file.json] [--max 80] [--write]\n  npx tsx scripts/generate-pubmed-monograph.ts --batch --write [--limit N]"
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
  console.log(`PubMed search: ${term.slice(0, 160)}…`);

  const ids = await esearch(term);
  console.log(`esearch: ${ids.length} PubMed results`);
  if (ids.length === 0) {
    console.error("No PubMed results — cannot compile a sheet.");
    process.exit(2);
  }

  await sleep(340);
  const fetchIds = ids.slice(0, MAX_ABSTRACTS);
  const articles = await efetchAbstracts(fetchIds);
  console.log(`efetch: ${articles.length} abstracts (of ${fetchIds.length})`);
  if (articles.length === 0) {
    console.error("No abstracts retrieved — cannot compile a sheet.");
    process.exit(2);
  }

  console.log(
    `Compiling sheet via Ollama Cloud (${COMPILE_MODELS.join(", ")}) …`
  );
  const { sheet, citedPmids, model } = await compileSheet(herb, articles);

  const citations = articles
    .filter((a) => citedPmids.includes(a.pmid))
    .map((a) => ({
      pmid: a.pmid,
      title: a.title,
      authors: [] as string[],
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
    pmids: citedPmids,
    article_count: articles.length,
    model,
    generated_at: new Date().toISOString(),
    status: "compiled",
  };

  const json = JSON.stringify(record, null, 2);
  if (outPath) {
    writeFileSync(outPath, json);
    console.log(`Sheet written to ${outPath}`);
  } else {
    console.log(json);
  }

  if (doWrite) {
    const sb = getSupabase();
    const { error } = await sb
      .from("herb_pubmed_monographs")
      .upsert(record, { onConflict: "slug" });
    if (error) throw new Error(`DB upsert failed: ${error.message}`);
    console.log(`✓ upserted herb_pubmed_monographs for ${herb.slug}`);
  }

  console.log(
    `\nSummary: ${articles.length} PubMed abstracts · ${citedPmids.length} cited · model ${model}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
