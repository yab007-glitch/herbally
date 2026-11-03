#!/usr/bin/env node
// Round 3 plain-fetch probes for the HerbAlly source licence audit.
//
// Two jobs in one pass, because both are plain fetch with the same policy:
//   A. Licence/policy pages round 1 and 2 did not cover.
//   B. robots.txt for every host HerbAlly harvests or intends to harvest.
//
// Same fetch style as scripts/probe-source-licences.mjs (round 1) and
// scripts/probe-source-licences-round2.mjs (round 2). The USDA hosts have
// answered HTTP2 with NGHTTP2_INTERNAL_ERROR before, so a failed fetch is
// retried once over curl with --http1.1 and the transport that worked is
// recorded.
//
// Evidence goes to artifacts/source-probes/2026-11-03/manifest-round3.json
// and artifacts/source-probes/2026-11-03/pages-round3/. The round-1
// manifest.json and round-2 manifest-round2.json are never touched.
//
// Usage: node scripts/probe-source-round3.mjs

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const PROBE_DIR = "artifacts/source-probes/2026-11-03";
const PROBE_DIR_ABS = join(REPO_ROOT, PROBE_DIR);
const PAGES_DIR = join(PROBE_DIR_ABS, "pages-round3");
const MANIFEST_PATH = join(PROBE_DIR_ABS, "manifest-round3.json");

const USER_AGENT =
  "HerbAlly-licence-audit/1.0 (+https://herbally.app; licence compliance review)";
const ACCEPT = "text/html,application/json,application/xml;q=0.9,*/*;q=0.8";
const REQUEST_TIMEOUT_MS = 60_000;
const SLEEP_BETWEEN_MS = 1_200;
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MAX_ROBOTS_RULES = 10;

const TARGETS = [
  ["nih-web-policies", "https://www.nih.gov/web-policies-notices"],
  [
    "nccih-website-policies",
    "https://www.nccih.nih.gov/about/nccih-website-policies",
  ],
  ["nlm-copyright", "https://www.nlm.nih.gov/copyright.html"],
  ["pubmed-disclaimer", "https://pubmed.ncbi.nlm.nih.gov/disclaimer/"],
  ["ncbi-policies", "https://www.ncbi.nlm.nih.gov/home/about/policies/"],
  ["pubchem-ftp-readme", "https://ftp.ncbi.nlm.nih.gov/pubchem/README"],
  ["usda-policies", "https://www.usda.gov/policies-and-links"],
  ["nrcs-policies", "https://www.nrcs.usda.gov/about/our-agency/nrcs-policies"],
  ["ogl-canada", "https://open.canada.ca/en/open-government-licence-canada"],
  [
    "ema-monograph-pdf",
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-zingiber-officinalis-rhizoma_en.pdf",
  ],
  ["gbif-techdocs", "https://techdocs.gbif.org/en/openapi/"],
];

const ROBOTS_TARGETS = [
  ["robots-powo", "https://powo.science.kew.org/robots.txt"],
  ["robots-kew", "https://www.kew.org/robots.txt"],
  ["robots-gbif-www", "https://www.gbif.org/robots.txt"],
  ["robots-gbif-api", "https://api.gbif.org/robots.txt"],
  ["robots-ncbi-eutils", "https://eutils.ncbi.nlm.nih.gov/robots.txt"],
  ["robots-pubchem", "https://pubchem.ncbi.nlm.nih.gov/robots.txt"],
  ["robots-ncbi-www", "https://www.ncbi.nlm.nih.gov/robots.txt"],
  ["robots-health-canada", "https://health-products.canada.ca/robots.txt"],
  ["robots-ema", "https://www.ema.europa.eu/robots.txt"],
  ["robots-usda-plants", "https://plants.sc.egov.usda.gov/robots.txt"],
  ["robots-nccih", "https://www.nccih.nih.gov/robots.txt"],
];

const sleep = (ms) =>
  new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

// The source family is the key prefix, e.g. "nih-web-policies" -> "nih" and
// "robots-powo" -> "robots".
const sourceOf = (key) => key.split("-")[0];

function extensionFor(contentType) {
  const ct = contentType.toLowerCase();
  if (ct.includes("json")) return "json";
  if (ct.includes("html")) return "html";
  if (ct.includes("xml")) return "xml";
  if (ct.includes("pdf")) return "pdf";
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

function isHttp2StreamError(err) {
  const text = `${err?.message ?? ""} ${err?.cause?.message ?? ""}`;
  return /NGHTTP2|HTTP2|Stream closed/i.test(text);
}

// USDA has broken Node's HTTP2 client before. Retry those hosts over
// HTTP/1.1 whenever plain fetch produced no HTTP response at all.
function shouldRetryWithCurl(record, err) {
  if (isHttp2StreamError(err)) return true;
  let hostname;
  try {
    hostname = new URL(record.url).hostname;
  } catch {
    return false;
  }
  return /(^|\.)(nrcs\.usda\.gov|usda\.gov)$/i.test(hostname);
}

function robotsRules(body) {
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /\b(disallow|crawl-delay|allow)\b/i.test(line))
    .slice(0, MAX_ROBOTS_RULES);
}

function newRecord(key, url, extra = {}) {
  return {
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
    transport: null,
    transport_attempts: ["fetch"],
    ...extra,
  };
}

async function saveBody(record, body) {
  record.bytes = body.byteLength;
  record.sha256 = createHash("sha256").update(body).digest("hex");

  const text = body.toString("utf8");
  record.title = extractTitle(text, record.content_type ?? "");

  if (body.byteLength > MAX_BODY_BYTES) {
    record.error = `body of ${body.byteLength} bytes exceeds ${MAX_BODY_BYTES} byte save limit; not saved`;
    return record;
  }

  const filename = `${record.key}.${extensionFor(record.content_type ?? "")}`;
  const savedPath = join(PAGES_DIR, filename);
  try {
    await writeFile(savedPath, body);
    record.saved_path = relative(REPO_ROOT, savedPath).split("\\").join("/");
  } catch (err) {
    record.error = `failed to save body: ${errorText(err)}`;
  }

  return record;
}

async function probeFetch(record) {
  const response = await fetch(record.url, {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      "User-Agent": USER_AGENT,
      Accept: ACCEPT,
    },
  });
  const body = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") ?? "";
  record.status = response.status;
  record.final_url = response.url || record.url;
  record.content_type = contentType.split(";")[0].trim() || null;
  record.transport = "fetch";
  return saveBody(record, body);
}

// curl is the fallback transport for hosts that break Node's HTTP2 client.
// -D captures the headers, -w the status/effective URL/content-type.
async function probeCurl(record) {
  const workDir = await mkdtemp(join(tmpdir(), "herbally-probe-"));
  const bodyPath = join(workDir, "body");
  const headersPath = join(workDir, "headers");
  try {
    const { stdout } = await execFileAsync(
      "curl",
      [
        "-sS",
        "--http1.1",
        "--max-time",
        "60",
        "-L",
        "-A",
        USER_AGENT,
        "-H",
        `Accept: ${ACCEPT}`,
        "-D",
        headersPath,
        "-o",
        bodyPath,
        "-w",
        "%{http_code}\n%{url_effective}\n%{content_type}",
        "--url",
        record.url,
      ],
      { maxBuffer: 1024 * 1024 }
    );
    const [statusLine, effectiveUrl, contentTypeLine] = stdout
      .split(/\r?\n/)
      .map((part) => part.trim());
    const status = Number.parseInt(statusLine, 10);
    if (!Number.isFinite(status) || status === 0) {
      throw new Error(
        `curl returned no usable HTTP status (${statusLine || "empty"})`
      );
    }

    let body = Buffer.alloc(0);
    try {
      body = await readFile(bodyPath);
    } catch {
      // A bodyless response (204, HEAD-like) is still a record.
    }

    record.status = status;
    record.final_url = effectiveUrl || record.url;
    record.content_type = (contentTypeLine || "").split(";")[0].trim() || null;
    record.transport = "curl-http1.1";
    return await saveBody(record, body);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function probe(key, url, extra = {}) {
  const record = newRecord(key, url, extra);

  try {
    return await probeFetch(record);
  } catch (err) {
    record.error = errorText(err);
    record.fetch_error = errorText(err);
    record.transport = null;
    if (!shouldRetryWithCurl(record, err)) return record;
  }

  // Plain fetch produced no HTTP response; retry once over HTTP/1.1.
  record.transport_attempts.push("curl-http1.1");
  try {
    record.error = null;
    return await probeCurl(record);
  } catch (err) {
    record.transport = "none";
    record.error = `fetch failed (${record.fetch_error}); curl --http1.1 retry failed: ${errorText(err)}`;
    return record;
  }
}

function cell(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ");
}

function renderTable(probes) {
  return [
    "| key | status | content-type | bytes | transport | final_url |",
    "| --- | --- | --- | --- | --- | --- |",
    ...probes.map(
      (probe) =>
        `| ${cell(probe.key)} | ${probe.status} | ${cell(probe.content_type ?? "-")} | ${probe.bytes} | ${cell(probe.transport)} | ${cell(probe.final_url ?? "-")} |`
    ),
  ].join("\n");
}

function renderRobotsTable(probes) {
  const lines = [
    "| key | status | content-type | bytes | rules (first 10) |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const probe of probes) {
    const rules =
      Array.isArray(probe.robots_rules) && probe.robots_rules.length
        ? probe.robots_rules.map((rule) => cell(rule)).join(" / ")
        : "-";
    lines.push(
      `| ${cell(probe.key)} | ${probe.status} | ${cell(probe.content_type ?? "-")} | ${probe.bytes} | ${rules} |`
    );
  }
  return lines.join("\n");
}

async function main() {
  await mkdir(PAGES_DIR, { recursive: true });

  const pageProbes = [];
  const robotsProbes = [];

  for (const [index, [key, url]] of TARGETS.entries()) {
    const record = await probe(key, url, { kind: "page" });
    pageProbes.push(record);
    process.stderr.write(
      `[page ${index + 1}/${TARGETS.length}] ${key} -> ${record.status} (${record.transport})${record.error ? ` (${record.error})` : ""}\n`
    );
    await sleep(SLEEP_BETWEEN_MS);
  }

  for (const [index, [key, url]] of ROBOTS_TARGETS.entries()) {
    const record = await probe(key, url, { kind: "robots" });
    const usable =
      record.status === 200 &&
      (record.content_type ?? "").toLowerCase().startsWith("text/plain");
    record.robots_rules = null;
    if (usable && record.saved_path) {
      const body = await readFile(join(REPO_ROOT, record.saved_path), "utf8");
      record.robots_rules = robotsRules(body);
    }
    robotsProbes.push(record);
    process.stderr.write(
      `[robots ${index + 1}/${ROBOTS_TARGETS.length}] ${key} -> ${record.status}, ${Array.isArray(record.robots_rules) ? record.robots_rules.length : 0} rule lines${record.error ? ` (${record.error})` : ""}\n`
    );
    if (index < ROBOTS_TARGETS.length - 1) await sleep(SLEEP_BETWEEN_MS);
  }

  const manifest = {
    generated_at: new Date().toISOString(),
    user_agent: USER_AGENT,
    probes: [...pageProbes, ...robotsProbes],
  };

  try {
    await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  } catch (err) {
    process.stderr.write(
      `FATAL: could not write manifest: ${errorText(err)}\n`
    );
    process.exitCode = 1;
    return;
  }

  const out = [
    "## Round 3 plain probes",
    renderTable(pageProbes),
    "",
    "## robots.txt probes",
    renderRobotsTable(robotsProbes),
  ];
  process.stdout.write(`${out.join("\n")}\n`);
}

await main();
