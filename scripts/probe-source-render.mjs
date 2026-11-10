#!/usr/bin/env node
// Rendered-page probe harness for the HerbAlly source licence audit.
//
// Round 1 used plain fetch. Several sources answered with Cloudflare
// challenges, JS shells, or bot walls, which tells us nothing about the
// licence text a human would actually see. This round renders each page in a
// real Chromium (Playwright), waits for challenges/client-side rendering, and
// captures the visible text.
//
// Usage: node scripts/probe-source-render.mjs

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Constant as specified: evidence lives under artifacts/source-probes/<date>/.
const PROBE_DIR = "artifacts/source-probes/2026-11-03/rendered";
const PROBE_DIR_ABS = join(REPO_ROOT, PROBE_DIR);

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const VIEWPORT = { width: 1280, height: 900 };
const LOCALE = "en-US";
const NAV_TIMEOUT_MS = 60_000;
// Cloudflare interstitials and SPA hydration both need a beat after
// domcontentloaded before innerText is meaningful.
const SETTLE_MS = 6_000;
const SLEEP_BETWEEN_MS = 2_000;
const TEXT_PREFIX_CHARS = 400;

const TARGETS = [
  ["r-pubchem-legal", "https://pubchem.ncbi.nlm.nih.gov/docs/legal-notices"],
  ["r-pubchem-downloads", "https://pubchem.ncbi.nlm.nih.gov/docs/downloads"],
  ["r-usda-plants-home", "https://plants.usda.gov/"],
  ["r-usda-plants-profile", "https://plants.usda.gov/plant-profile/ZIOF"],
  ["r-powo-home", "https://powo.science.kew.org/"],
  [
    "r-powo-api",
    "https://powo.science.kew.org/api/2/search?q=Zingiber%20officinale&limit=1",
  ],
  ["r-kew-terms", "https://www.kew.org/terms-and-conditions"],
  ["r-gbif-terms", "https://www.gbif.org/terms"],
  [
    "r-gbif-backbone",
    "https://www.gbif.org/dataset/d7dddbf4-2cf0-4f39-9b2a-bb099caae36c",
  ],
];

const sleep = (ms) =>
  new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

function errorText(err) {
  const base = err?.message
    ? `${err.name ?? "Error"}: ${err.message}`
    : String(err);
  const cause = err?.cause?.message ? ` (${err.cause.message})` : "";
  return base + cause;
}

async function render(page, key, url) {
  const record = {
    key,
    url,
    status: 0,
    final_url: null,
    title: null,
    text_chars: 0,
    text_prefix: "",
    error: null,
    saved_path: null,
  };

  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT_MS,
    });
    record.status = response ? response.status() : 0;
    record.final_url = page.url();

    // Give Cloudflare challenges and client-side rendering time to resolve.
    await page.waitForTimeout(SETTLE_MS);

    record.final_url = page.url();
    record.title = await page.title();

    const text = await page.evaluate(() => {
      const body = document.body;
      if (!body) return "";
      return body.innerText ?? "";
    });
    record.text_chars = text.length;
    record.text_prefix = text.slice(0, TEXT_PREFIX_CHARS);

    const bodyText = [
      `title: ${record.title ?? ""}`,
      `final_url: ${record.final_url ?? ""}`,
      "",
      text,
    ].join("\n");

    const savedPath = join(PROBE_DIR_ABS, `${key}.txt`);
    try {
      await writeFile(savedPath, bodyText);
      record.saved_path = relative(REPO_ROOT, savedPath).split("\\").join("/");
    } catch (err) {
      record.error = `failed to save text: ${errorText(err)}`;
    }
  } catch (err) {
    record.error = errorText(err);
    // A navigation that threw may still have a page URL/title worth keeping.
    try {
      record.final_url = page.url();
      record.title = await page.title();
      const text = await page.evaluate(() =>
        document.body ? (document.body.innerText ?? "") : ""
      );
      record.text_chars = text.length;
      record.text_prefix = text.slice(0, TEXT_PREFIX_CHARS);
    } catch {
      // Ignore secondary failures; the original error is the finding.
    }
  }

  return record;
}

async function main() {
  await mkdir(PROBE_DIR_ABS, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: VIEWPORT,
    locale: LOCALE,
  });

  const probes = [];
  try {
    for (const [index, [key, url]] of TARGETS.entries()) {
      const page = await context.newPage();
      const record = await render(page, key, url);
      probes.push(record);
      process.stderr.write(
        `[${index + 1}/${TARGETS.length}] ${key} -> ${record.status}, ${record.text_chars} chars${record.error ? ` (${record.error})` : ""}\n`
      );
      await page.close();
      if (index < TARGETS.length - 1) await sleep(SLEEP_BETWEEN_MS);
    }
  } finally {
    await context.close();
    await browser.close();
  }

  const manifest = {
    generated_at: new Date().toISOString(),
    user_agent: USER_AGENT,
    viewport: VIEWPORT,
    locale: LOCALE,
    settle_ms: SETTLE_MS,
    probes,
  };

  const manifestPath = join(PROBE_DIR_ABS, "manifest.json");
  try {
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  } catch (err) {
    process.stderr.write(
      `FATAL: could not write manifest: ${errorText(err)}\n`
    );
    process.exitCode = 1;
    return;
  }

  const out = [
    "| key | status | text_chars | title | final_url |",
    "| --- | --- | --- | --- | --- |",
    ...probes.map((probe) => {
      const cell = (value) =>
        String(value ?? "")
          .replace(/\|/g, "\\|")
          .replace(/\n/g, " ");
      return `| ${cell(probe.key)} | ${probe.status} | ${probe.text_chars} | ${cell(probe.title ?? "-")} | ${cell(probe.final_url ?? "-")} |`;
    }),
  ];
  process.stdout.write(`${out.join("\n")}\n`);
}

await main();
