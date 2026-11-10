#!/usr/bin/env node
// Round 2 plain-fetch probes for the HerbAlly source licence audit.
//
// Same fetch style as scripts/probe-source-licences.mjs (round 1). Adds the
// URLs round 1 skipped or that needed corrected paths, then reads the saved
// NCCIH sitemap and probes up to three policy/copyright/reuse pages from it.
//
// Evidence goes to artifacts/source-probes/2026-11-03/manifest-round2.json
// and artifacts/source-probes/2026-11-03/pages-round2/. The round-1
// manifest.json is never touched.
//
// Usage: node scripts/probe-source-licences-round2.mjs

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const PROBE_DIR = "artifacts/source-probes/2026-11-03";
const PROBE_DIR_ABS = join(REPO_ROOT, PROBE_DIR);
const PAGES_DIR = join(PROBE_DIR_ABS, "pages-round2");
const MANIFEST_PATH = join(PROBE_DIR_ABS, "manifest-round2.json");

const USER_AGENT =
  "HerbAlly-licence-audit/1.0 (+https://herbally.app; licence compliance review)";
const ACCEPT = "text/html,application/json,application/xml;q=0.9,*/*;q=0.8";
const REQUEST_TIMEOUT_MS = 60_000;
const SLEEP_BETWEEN_MS = 1_200;
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MAX_NCCIH_CANDIDATES = 3;

const TARGETS = [
  ["nccih-sitemap", "https://www.nccih.nih.gov/sitemap.xml"],
  [
    "ema-herbal-index",
    "https://www.ema.europa.eu/en/medicines/field_26/herbal-medicines",
  ],
  [
    "ema-hmpc-overview",
    "https://www.ema.europa.eu/en/human-regulatory-overview/herbal-medicinal-products",
  ],
  [
    "gbif-backbone-api",
    "https://api.gbif.org/v1/dataset/d7dddbf4-2cf0-4f39-9b2a-bb099caae36c",
  ],
  [
    "gbif-occurrence-api",
    "https://api.gbif.org/v1/occurrence/search?q=Zingiber%20officinale&limit=1",
  ],
  [
    "wikipedia-copyrights",
    "https://en.wikipedia.org/wiki/Wikipedia:Copyrights",
  ],
  ["usda-plants-mainjs", "https://plants.sc.egov.usda.gov/main.js"],
  ["nrcs-terms", "https://www.nrcs.usda.gov/about/our-agency/nrcs-policies"],
];

const sleep = (ms) =>
  new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

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

async function probe(key, url, extra = {}) {
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
    ...extra,
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

// Round-1 sitemap is a <urlset> of <loc> entries. Match the path only, so a
// query string or hostname mentioning a keyword cannot nominate a page.
function nccihCandidates(sitemapXml) {
  const locs = [...sitemapXml.matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/gi)].map(
    (match) => decodeEntities(match[1].trim())
  );
  const seen = new Set();
  const candidates = [];
  for (const loc of locs) {
    let url;
    try {
      url = new URL(loc);
    } catch {
      continue;
    }
    if (url.hostname !== "www.nccih.nih.gov") continue;
    if (!/(copyright|reuse|web[-_]?polic)/i.test(url.pathname)) continue;
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    candidates.push(url.href);
    if (candidates.length >= MAX_NCCIH_CANDIDATES) break;
  }
  return candidates;
}

async function main() {
  await mkdir(PAGES_DIR, { recursive: true });

  const probes = [];
  const writeManifest = async () => {
    const manifest = {
      generated_at: new Date().toISOString(),
      user_agent: USER_AGENT,
      probes,
    };
    await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  };

  for (const [index, [key, url]] of TARGETS.entries()) {
    const record = await probe(key, url);
    probes.push(record);
    process.stderr.write(
      `[${index + 1}/${TARGETS.length}] ${key} -> ${record.status}${record.error ? ` (${record.error})` : ""}\n`
    );
    if (index < TARGETS.length - 1) await sleep(SLEEP_BETWEEN_MS);
  }

  // Task C: derive NCCIH policy/copyright/reuse URLs from the saved sitemap.
  const sitemap = probes.find((record) => record.key === "nccih-sitemap");
  const sitemapUsable =
    sitemap &&
    sitemap.status >= 200 &&
    sitemap.status < 300 &&
    sitemap.saved_path;

  let candidates = [];
  if (sitemapUsable) {
    const { readFile } = await import("node:fs/promises");
    const xml = await readFile(join(REPO_ROOT, sitemap.saved_path), "utf8");
    candidates = nccihCandidates(xml);
    process.stderr.write(
      `NCCIH sitemap candidates: ${candidates.length ? candidates.join(", ") : "none matched"}\n`
    );
    for (const [index, url] of candidates.entries()) {
      await sleep(SLEEP_BETWEEN_MS);
      const record = await probe(`nccih-candidate-${index + 1}`, url, {
        selected_from: "nccih-sitemap",
      });
      probes.push(record);
      process.stderr.write(
        `[nccih ${index + 1}/${candidates.length}] ${url} -> ${record.status}${record.error ? ` (${record.error})` : ""}\n`
      );
    }
  } else {
    process.stderr.write(
      `NCCIH sitemap probe failed (status ${sitemap?.status ?? "missing"}); skipping Task C candidates.\n`
    );
  }

  try {
    await writeManifest();
  } catch (err) {
    process.stderr.write(
      `FATAL: could not write manifest: ${errorText(err)}\n`
    );
    process.exitCode = 1;
    return;
  }

  const out = [
    "| key | status | content-type | bytes | final_url |",
    "| --- | --- | --- | --- | --- |",
    ...probes.map((probe) => {
      const cell = (value) =>
        String(value ?? "")
          .replace(/\|/g, "\\|")
          .replace(/\n/g, " ");
      return `| ${cell(probe.key)} | ${probe.status} | ${cell(probe.content_type ?? "-")} | ${probe.bytes} | ${cell(probe.final_url ?? "-")} |`;
    }),
  ];
  process.stdout.write(`${out.join("\n")}\n`);
}

await main();
