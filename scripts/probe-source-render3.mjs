#!/usr/bin/env node
// Round 3 rendered probes for the HerbAlly source licence audit.
//
// Round 2 rendered the hard-walled sources in headless Chromium with a 6 s
// settle; Powo, Kew, GBIF and PubChem still showed a bot wall. This round
// waits 25 s to separate "needs more time" from "hard wall", and captures
// the final title plus the first 300 characters of innerText.
//
// Evidence goes to artifacts/source-probes/2026-11-03/rendered-round3/.
//
// Usage: node scripts/probe-source-render3.mjs

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const PROBE_DIR = "artifacts/source-probes/2026-11-03/rendered-round3";
const PROBE_DIR_ABS = join(REPO_ROOT, PROBE_DIR);

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const VIEWPORT = { width: 1280, height: 900 };
const LOCALE = "en-US";
const NAV_TIMEOUT_MS = 60_000;
// The whole point of round 3: a far longer settle than round 2's 6 s.
const SETTLE_MS = 25_000;
const SLEEP_BETWEEN_MS = 5_000;
const TEXT_PREFIX_CHARS = 300;

const TARGETS = [
  ["r3-pubchem-legal", "https://pubchem.ncbi.nlm.nih.gov/docs/legal-notices"],
  ["r3-gbif-terms", "https://www.gbif.org/terms"],
  ["r3-powo-home", "https://powo.science.kew.org/"],
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

    // Give Cloudflare challenges and client-side rendering a long beat.
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

  const cell = (value) =>
    String(value ?? "")
      .replace(/\|/g, "\\|")
      .replace(/\n/g, " ");
  const out = [
    "| key | status | text_chars | title |",
    "| --- | --- | --- | --- |",
    ...probes.map(
      (probe) =>
        `| ${cell(probe.key)} | ${probe.status} | ${probe.text_chars} | ${cell(probe.title ?? "-")} |`
    ),
  ];
  process.stdout.write(`${out.join("\n")}\n`);
}

await main();
