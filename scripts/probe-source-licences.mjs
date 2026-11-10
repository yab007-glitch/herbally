#!/usr/bin/env node
// Licence and access probe harness for HerbAlly data sources.
//
// Probes a fixed list of source URLs, stores every response body as raw
// evidence, and writes a JSON + Markdown manifest. A 403, 404, redirect or
// refused connection is a finding, not a failure: the run exits 0 as long as
// the manifest can be written.
//
// Usage: node scripts/probe-source-licences.mjs

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Constant as specified: evidence lives under artifacts/source-probes/<date>/.
const PROBE_DIR = "artifacts/source-probes/2026-11-03";
const PROBE_DIR_ABS = join(REPO_ROOT, PROBE_DIR);
const PAGES_DIR = join(PROBE_DIR_ABS, "pages");

const USER_AGENT =
  "HerbAlly-licence-audit/1.0 (+https://herbally.app; licence compliance review)";
const ACCEPT = "text/html,application/json,application/xml;q=0.9,*/*;q=0.8";
const REQUEST_TIMEOUT_MS = 60_000;
const SLEEP_BETWEEN_MS = 1_200;
const MAX_BODY_BYTES = 8 * 1024 * 1024;

const TARGETS = [
  ["nccih-home", "https://www.nccih.nih.gov/"],
  ["nccih-legal", "https://www.nccih.nih.gov/about/legal-information"],
  ["nccih-policies", "https://www.nccih.nih.gov/about/policies"],
  ["nccih-herbs", "https://www.nccih.nih.gov/health/herbsataglance"],
  ["pubmed-home", "https://pubmed.ncbi.nlm.nih.gov/"],
  [
    "ncbi-eutils-live",
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=Zingiber+officinale&retmode=json&retmax=3",
  ],
  ["ncbi-eutils-guidelines", "https://www.ncbi.nlm.nih.gov/books/NBK25497/"],
  [
    "nlm-terms",
    "https://www.nlm.nih.gov/databases/download/terms_and_conditions.html",
  ],
  ["nlm-web-policies", "https://www.nlm.nih.gov/web_policies.html"],
  [
    "pubchem-live",
    "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/gingerol/cids/JSON",
  ],
  ["pubchem-legal", "https://pubchem.ncbi.nlm.nih.gov/docs/legal-notices"],
  ["pubchem-downloads", "https://pubchem.ncbi.nlm.nih.gov/docs/downloads"],
  ["usda-plants-home", "https://plants.usda.gov/"],
  ["usda-plants-legacy", "https://plants.sc.egov.usda.gov/"],
  ["usda-plants-profile", "https://plants.usda.gov/plant-profile/ZIOF"],
  ["nrcs-home", "https://www.nrcs.usda.gov/"],
  ["powo-home", "https://powo.science.kew.org/"],
  [
    "powo-live",
    "https://powo.science.kew.org/api/2/search?q=Zingiber%20officinale&limit=1",
  ],
  ["powo-about", "https://powo.science.kew.org/about"],
  ["kew-terms", "https://www.kew.org/terms-and-conditions"],
  [
    "gbif-live",
    "https://api.gbif.org/v1/species/match?name=Zingiber%20officinale",
  ],
  ["gbif-terms", "https://www.gbif.org/terms"],
  ["gbif-citation", "https://www.gbif.org/citation-guidelines"],
  [
    "gbif-backbone-dataset",
    "https://www.gbif.org/dataset/d7dddbf4-2cf0-4f39-9b2a-bb099caae36c",
  ],
  [
    "wikidata-live",
    "https://www.wikidata.org/w/api.php?action=wbsearchentities&search=Zingiber%20officinale&language=en&format=json&limit=3",
  ],
  ["wikidata-licensing", "https://www.wikidata.org/wiki/Wikidata:Licensing"],
  [
    "wikidata-data-access",
    "https://www.wikidata.org/wiki/Wikidata:Data_access",
  ],
  [
    "lnhpd-live",
    "https://health-products.canada.ca/api/natural-licences/productlicence/?lang=en&type=json&page=1",
  ],
  [
    "lnhpd-dataset",
    "https://open.canada.ca/data/en/dataset/d8a2b7d4-1bf7-4d0c-9c0e-000000000000",
  ],
  [
    "lnhpd-licence-page",
    "https://health-products.canada.ca/lnhpd-bdpsnh/info?licence=80000001",
  ],
  ["ema-herbal", "https://www.ema.europa.eu/en/medicines/herbal"],
  ["ema-legal", "https://www.ema.europa.eu/en/about-us/legal-notice"],
  [
    "ema-monograph",
    "https://www.ema.europa.eu/en/medicines/herbal/zingiberis-officinalis-rhizoma",
  ],
];

const sleep = (ms) =>
  new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

// The source family is the key prefix, e.g. "powo-live" -> "powo".
const sourceOf = (key) => key.split("-")[0];

function extensionFor(contentType) {
  const ct = contentType.toLowerCase();
  if (ct.includes("json")) return "json";
  if (ct.includes("html")) return "html";
  if (ct.includes("xml")) return "xml";
  return "txt";
}

function decodeEntities(text) {
  return text
    .replace(/&(?:amp|#38);/gi, "&")
    .replace(/&(?:lt|#60);/gi, "<")
    .replace(/&(?:gt|#62);/gi, ">")
    .replace(/&(?:quot|#34);/gi, '"')
    .replace(/&(?:apos|#39);/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(parseInt(code, 16))
    );
}

function extractTitle(body, contentType) {
  if (!contentType.toLowerCase().includes("html")) return null;
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(body);
  if (!match) return null;
  const title = decodeEntities(match[1]).replace(/\s+/g, " ").trim();
  return title ? title.slice(0, 200) : null;
}

function errorText(err) {
  const base = err?.message
    ? `${err.name ?? "Error"}: ${err.message}`
    : String(err);
  const cause = err?.cause?.message ? ` (${err.cause.message})` : "";
  return base + cause;
}

async function probe(key, url) {
  const record = {
    key,
    source: sourceOf(key),
    url,
    status: 0,
    final_url: null,
    content_type: null,
    bytes: 0,
    sha256: null,
    error: null,
    saved_path: null,
    title: null,
  };

  let response;
  let body;
  try {
    response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        "User-Agent": USER_AGENT,
        Accept: ACCEPT,
      },
    });
    body = Buffer.from(await response.arrayBuffer());
  } catch (err) {
    // Refused connection, DNS failure, timeout: status 0 and the error text.
    record.error = errorText(err);
    if (response) record.status = response.status;
    return record;
  }

  const contentType = response.headers.get("content-type") ?? "";
  record.status = response.status;
  record.final_url = response.url || url;
  record.content_type = contentType.split(";")[0].trim() || null;
  record.bytes = body.byteLength;
  record.sha256 = createHash("sha256").update(body).digest("hex");

  const text = body.toString("utf8");
  record.title = extractTitle(text, record.content_type ?? "");

  if (body.byteLength > MAX_BODY_BYTES) {
    record.error = `body of ${body.byteLength} bytes exceeds ${MAX_BODY_BYTES} byte save limit; not saved`;
    return record;
  }

  const filename = `${key}.${extensionFor(record.content_type ?? "")}`;
  const savedPath = join(PAGES_DIR, filename);
  try {
    await writeFile(savedPath, body);
    record.saved_path = relative(REPO_ROOT, savedPath).split("\\").join("/");
  } catch (err) {
    record.error = `failed to save body: ${errorText(err)}`;
  }

  return record;
}

function statusClass(status) {
  if (status === 0) return "network";
  if (status >= 200 && status < 300) return "2xx";
  if (status >= 300 && status < 400) return "3xx";
  if (status >= 400 && status < 500) return "4xx";
  if (status >= 500) return "5xx";
  return "other";
}

function renderMarkdown(probes) {
  const cell = (value) =>
    String(value ?? "")
      .replace(/\|/g, "\\|")
      .replace(/\n/g, " ");
  const lines = [
    "| key | status | content-type | bytes | final_url |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const probe of probes) {
    lines.push(
      `| ${cell(probe.key)} | ${probe.status} | ${cell(probe.content_type ?? "-")} | ${probe.bytes} | ${cell(probe.final_url ?? "-")} |`
    );
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  await mkdir(PAGES_DIR, { recursive: true });

  const probes = [];
  for (const [index, [key, url]] of TARGETS.entries()) {
    const record = await probe(key, url);
    probes.push(record);
    process.stderr.write(
      `[${index + 1}/${TARGETS.length}] ${key} -> ${record.status}${record.error ? ` (${record.error})` : ""}\n`
    );
    if (index < TARGETS.length - 1) await sleep(SLEEP_BETWEEN_MS);
  }

  const manifest = {
    generated_at: new Date().toISOString(),
    user_agent: USER_AGENT,
    probes,
  };
  const markdown = renderMarkdown(probes);

  const manifestJsonPath = join(PROBE_DIR_ABS, "manifest.json");
  const manifestMdPath = join(PROBE_DIR_ABS, "manifest.md");

  try {
    await writeFile(manifestJsonPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await writeFile(manifestMdPath, markdown);
  } catch (err) {
    process.stderr.write(
      `FATAL: could not write manifest: ${errorText(err)}\n`
    );
    process.exitCode = 1;
    return;
  }

  const classes = new Map();
  for (const record of probes) {
    const name = statusClass(record.status);
    classes.set(name, (classes.get(name) ?? 0) + 1);
  }
  const non2xx = probes
    .filter((record) => record.status < 200 || record.status >= 300)
    .map((record) => `${record.key} (${record.status})`);

  const out = [
    `Total probes: ${probes.length}`,
    ...[...classes.entries()].map(([name, count]) => `  ${name}: ${count}`),
    `Non-2xx keys: ${non2xx.length ? non2xx.join(", ") : "none"}`,
    "",
    markdown.trimEnd(),
  ];
  process.stdout.write(`${out.join("\n")}\n`);
}

await main();
