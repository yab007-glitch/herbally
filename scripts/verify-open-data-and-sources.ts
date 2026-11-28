#!/usr/bin/env tsx
/**
 * A8 Automated Scientific Source, Integrity Manifest & OpenAPI Contract Monitor.
 *
 * Verifies live /open-data/*.json exports against atomic snapshotId, SHA-256
 * digests in /open-data/manifest.json, HTTP Cache-Control headers, and OpenAPI
 * 3.1.0 invariants; exercises public interaction API error & unknown-herb
 * behavior; queries NCBI E-utilities esummary across all cited PubMed PMIDs
 * to detect retracted publications; and probes unique non-PubMed regulatory
 * citation URLs using per-host pacing to minimize rate-limit false positives.
 *
 * Usage:
 *   npx tsx scripts/verify-open-data-and-sources.ts [--base-url https://herbally.app] [--json-out report.json]
 */

import { createHash } from "node:crypto";
import fs from "node:fs";

interface MonitorReport {
  checkedAt: string;
  baseUrl: string;
  snapshotId: string;
  datasetVersion: string;
  counts: {
    medications: number;
    interactions: number;
    quarantinedBotanicals: number;
    clinicianSignedInteractions: number;
  };
  manifestVerified: boolean;
  manifestFiles: Record<
    string,
    { sha256: string; bytes: number; verified: boolean }
  >;
  apiContractChecks: {
    badInputStatus: number;
    unknownHerbStatus: number;
    unknownHerbFound: boolean;
    openApiVersion: string;
  };
  citations: {
    totalUniqueUrls: number;
    uniquePmids: number;
    retractedPmids: string[];
    nonPubmedUrlsChecked: number;
    nonPubmedOk: number;
    nonPubmedBotBlockedOrRateLimited: Array<{ url: string; status: number }>;
    brokenUrls: Array<{ url: string; reason: string }>;
  };
}

function parseArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function fetchJsonRaw<T>(url: string): Promise<{
  res: Response;
  rawText: string;
  data: T;
}> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  const rawText = await res.text();
  const data = JSON.parse(rawText) as T;
  return { res, rawText, data };
}

function extractPmid(url: string): string | null {
  const match = /^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)\/?$/i.exec(
    url.trim()
  );
  return match ? match[1] : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkRetractedPmids(pmids: string[]): Promise<string[]> {
  const retracted: string[] = [];
  for (let i = 0; i < pmids.length; i += 50) {
    const batch = pmids.slice(i, i + 50);
    const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${batch.join(",")}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      throw new Error(`NCBI esummary returned HTTP ${res.status}`);
    }
    const payload = (await res.json()) as {
      result?: Record<string, { pubtype?: string[] }>;
    };
    for (const pmid of batch) {
      const types = payload.result?.[pmid]?.pubtype ?? [];
      if (
        types.some((t) =>
          /Retracted Publication|Retraction of Publication/i.test(t)
        )
      ) {
        retracted.push(pmid);
      }
    }
  }
  return retracted;
}

const BROWSER_PROBE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; HerbAlly-SourceMonitor/1.1; +https://herbally.app/trust)",
  Accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

async function probeUrl(
  url: string
): Promise<
  | { kind: "ok"; status: number }
  | { kind: "blocked"; status: number }
  | { kind: "broken"; reason: string }
> {
  for (const method of ["HEAD", "GET"] as const) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, {
          method,
          redirect: "follow",
          headers: BROWSER_PROBE_HEADERS,
          signal: AbortSignal.timeout(15_000),
        });
        if (res.status >= 200 && res.status < 400) {
          return { kind: "ok", status: res.status };
        }
        if (method === "HEAD" && res.status === 405) {
          break;
        }
        if (res.status === 429 && attempt === 0) {
          const retryAfterSec = Number(res.headers.get("retry-after") || "2");
          await sleep(Math.min(5_000, Math.max(1_500, retryAfterSec * 1_000)));
          continue;
        }
        if (res.status === 403 || res.status === 429) {
          return { kind: "blocked", status: res.status };
        }
        if (res.status === 404 || res.status === 410) {
          return { kind: "broken", reason: `HTTP ${res.status}` };
        }
        if (method === "GET") {
          return { kind: "blocked", status: res.status };
        }
        break;
      } catch (err) {
        if (method === "GET" && attempt === 1) {
          return {
            kind: "broken",
            reason: err instanceof Error ? err.message : String(err),
          };
        }
        await sleep(500);
      }
    }
  }
  return { kind: "broken", reason: "unreachable" };
}

/** Probe non-PubMed URLs grouped by host so each upstream origin sees >= 1.5s spacing. */
async function probeUrlsWithHostPacing(urls: string[]): Promise<{
  nonPubmedOk: number;
  botBlocked: Array<{ url: string; status: number }>;
  brokenUrls: Array<{ url: string; reason: string }>;
}> {
  const byHost = new Map<string, string[]>();
  for (const url of urls) {
    const host = new URL(url).hostname;
    const queue = byHost.get(host) ?? [];
    queue.push(url);
    byHost.set(host, queue);
  }

  let nonPubmedOk = 0;
  const botBlocked: Array<{ url: string; status: number }> = [];
  const brokenUrls: Array<{ url: string; reason: string }> = [];

  const hostQueues = Array.from(byHost.values());
  let queueIdx = 0;

  async function runHostWorker(): Promise<void> {
    while (queueIdx < hostQueues.length) {
      const queue = hostQueues[queueIdx++];
      if (!queue) break;
      for (let i = 0; i < queue.length; i++) {
        const url = queue[i];
        const result = await probeUrl(url);
        if (result.kind === "ok") {
          nonPubmedOk += 1;
        } else if (result.kind === "blocked") {
          botBlocked.push({ url, status: result.status });
        } else {
          brokenUrls.push({ url, reason: result.reason });
        }
        if (i + 1 < queue.length) {
          await sleep(1_500);
        }
      }
    }
  }

  const concurrency = Math.min(3, Math.max(1, hostQueues.length));
  await Promise.all(Array.from({ length: concurrency }, () => runHostWorker()));

  return { nonPubmedOk, botBlocked, brokenUrls };
}

async function main() {
  const baseUrl = (parseArg("--base-url") ?? "https://herbally.app").replace(
    /\/+$/,
    ""
  );
  const jsonOut = parseArg("--json-out");

  const [catalogR, medsR, ixR, qR, privacyR, reviewQueueR, schemaR, manifestR] =
    await Promise.all([
      fetchJsonRaw<{
        datasetVersion: string;
        snapshotId: string;
        generatedAt: string;
        counts: Record<string, number>;
      }>(`${baseUrl}/open-data/catalog.json`),
      fetchJsonRaw<{
        datasetVersion: string;
        snapshotId: string;
        generatedAt: string;
        totalMedications: number;
        totalInteractionPairs: number;
      }>(`${baseUrl}/open-data/medications.json`),
      fetchJsonRaw<{
        datasetVersion: string;
        snapshotId: string;
        generatedAt: string;
        totalPairs: number;
        clinicianSignedPairs: number;
        interactions: Array<{ sourceUrl: string | null }>;
      }>(`${baseUrl}/open-data/interactions.json`),
      fetchJsonRaw<{
        datasetVersion: string;
        snapshotId: string;
        generatedAt: string;
        totalQuarantinedBotanicals: number;
      }>(`${baseUrl}/open-data/quarantine.json`),
      fetchJsonRaw<{
        datasetVersion: string;
        snapshotId: string;
        generatedAt: string;
      }>(`${baseUrl}/open-data/privacy-manifest.json`),
      fetchJsonRaw<{
        datasetVersion: string;
        snapshotId: string;
        generatedAt: string;
        summary: { priorityQueueCount: number };
      }>(`${baseUrl}/open-data/review-queue.json`),
      fetchJsonRaw<{
        openapi: string;
        info: { version: string };
        paths: Record<string, unknown>;
      }>(`${baseUrl}/open-data/schema.json`),
      fetchJsonRaw<{
        datasetVersion: string;
        snapshotId: string;
        generatedAt: string;
        algorithm: string;
        files: Record<string, { sha256: string; bytes: number }>;
      }>(`${baseUrl}/open-data/manifest.json`),
    ]);

  for (const r of [
    catalogR,
    medsR,
    ixR,
    qR,
    privacyR,
    reviewQueueR,
    schemaR,
    manifestR,
  ]) {
    if (r.res.headers.get("access-control-allow-origin") !== "*") {
      throw new Error(`Missing CORS * header on ${r.res.url}`);
    }
    const cc = r.res.headers.get("cache-control") ?? "";
    if (!cc.includes("s-maxage=60") || !cc.includes("must-revalidate")) {
      throw new Error(
        `Unexpected Cache-Control "${cc}" on ${r.res.url} (expected s-maxage=60, must-revalidate)`
      );
    }
  }

  const snapshotId = catalogR.data.snapshotId;
  if (
    medsR.data.snapshotId !== snapshotId ||
    ixR.data.snapshotId !== snapshotId ||
    qR.data.snapshotId !== snapshotId ||
    privacyR.data.snapshotId !== snapshotId ||
    reviewQueueR.data.snapshotId !== snapshotId ||
    manifestR.data.snapshotId !== snapshotId
  ) {
    throw new Error(
      `Snapshot mismatch: catalog=${snapshotId}, meds=${medsR.data.snapshotId}, ix=${ixR.data.snapshotId}, q=${qR.data.snapshotId}, privacy=${privacyR.data.snapshotId}, reviewQueue=${reviewQueueR.data.snapshotId}, manifest=${manifestR.data.snapshotId}`
    );
  }

  const rawByPath: Record<string, string> = {
    "/open-data/catalog.json": catalogR.rawText,
    "/open-data/medications.json": medsR.rawText,
    "/open-data/interactions.json": ixR.rawText,
    "/open-data/quarantine.json": qR.rawText,
    "/open-data/privacy-manifest.json": privacyR.rawText,
    "/open-data/review-queue.json": reviewQueueR.rawText,
    "/open-data/schema.json": schemaR.rawText,
  };
  const manifestFiles: Record<
    string,
    { sha256: string; bytes: number; verified: boolean }
  > = {};
  for (const [filePath, rawText] of Object.entries(rawByPath)) {
    const entry = manifestR.data.files[filePath];
    if (!entry) {
      throw new Error(`Missing ${filePath} in /open-data/manifest.json`);
    }
    const actualHash = createHash("sha256")
      .update(rawText, "utf8")
      .digest("hex");
    const actualBytes = Buffer.byteLength(rawText, "utf8");
    if (actualHash !== entry.sha256) {
      throw new Error(
        `SHA-256 mismatch for ${filePath}: manifest=${entry.sha256}, live=${actualHash}`
      );
    }
    manifestFiles[filePath] = {
      sha256: actualHash,
      bytes: actualBytes,
      verified: true,
    };
  }

  if (
    catalogR.data.counts.publishedInteractionPairs !== ixR.data.totalPairs ||
    medsR.data.totalInteractionPairs !== ixR.data.totalPairs ||
    catalogR.data.counts.medicationsAndClasses !==
      medsR.data.totalMedications ||
    catalogR.data.counts.quarantinedToxicBotanicals !==
      qR.data.totalQuarantinedBotanicals
  ) {
    throw new Error("Count mismatch across /open-data/*.json endpoints");
  }

  if (schemaR.data.openapi !== "3.1.0") {
    throw new Error(`Expected OpenAPI 3.1.0, got ${schemaR.data.openapi}`);
  }

  const [badApi, unknownApi] = await Promise.all([
    fetch(`${baseUrl}/api/interactions/check?herb=a&drug=b`, {
      signal: AbortSignal.timeout(10_000),
    }),
    fetch(
      `${baseUrl}/api/interactions/check?herb=nonexistent-botanical-xyz&drug=warfarin`,
      { signal: AbortSignal.timeout(10_000) }
    ),
  ]);
  const unknownJson = (await unknownApi.json()) as { found: boolean };
  if (badApi.status !== 400 || unknownApi.status !== 200 || unknownJson.found) {
    throw new Error("Live /api/interactions/check contract probe failed");
  }

  const uniqueUrls = Array.from(
    new Set(
      ixR.data.interactions
        .map((p) => p.sourceUrl?.trim())
        .filter((u): u is string => Boolean(u))
    )
  ).sort();

  const pmids: string[] = [];
  const nonPubmedUrls: string[] = [];
  const schemeBroken: Array<{ url: string; reason: string }> = [];

  for (const url of uniqueUrls) {
    if (!url.startsWith("https://")) {
      schemeBroken.push({ url, reason: "Non-HTTPS source URL" });
      continue;
    }
    const pmid = extractPmid(url);
    if (pmid) pmids.push(pmid);
    else nonPubmedUrls.push(url);
  }

  const retractedPmids = await checkRetractedPmids(pmids);
  const { nonPubmedOk, botBlocked, brokenUrls } =
    await probeUrlsWithHostPacing(nonPubmedUrls);
  const allBroken = [...schemeBroken, ...brokenUrls];

  const report: MonitorReport = {
    checkedAt: new Date().toISOString(),
    baseUrl,
    snapshotId,
    datasetVersion: catalogR.data.datasetVersion,
    counts: {
      medications: medsR.data.totalMedications,
      interactions: ixR.data.totalPairs,
      quarantinedBotanicals: qR.data.totalQuarantinedBotanicals,
      clinicianSignedInteractions: ixR.data.clinicianSignedPairs,
    },
    manifestVerified: true,
    manifestFiles,
    apiContractChecks: {
      badInputStatus: badApi.status,
      unknownHerbStatus: unknownApi.status,
      unknownHerbFound: unknownJson.found,
      openApiVersion: schemaR.data.openapi,
    },
    citations: {
      totalUniqueUrls: uniqueUrls.length,
      uniquePmids: pmids.length,
      retractedPmids,
      nonPubmedUrlsChecked: nonPubmedUrls.length,
      nonPubmedOk,
      nonPubmedBotBlockedOrRateLimited: botBlocked,
      brokenUrls: allBroken,
    },
  };

  if (jsonOut) {
    fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2) + "\n");
  }
  console.log(JSON.stringify(report, null, 2));

  if (retractedPmids.length > 0 || allBroken.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
