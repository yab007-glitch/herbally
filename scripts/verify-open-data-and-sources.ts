#!/usr/bin/env tsx
/**
 * A8 Automated Scientific Source & OpenAPI Contract Monitor.
 *
 * Verifies live /open-data/*.json exports against atomic snapshotId &
 * OpenAPI 3.1.0 contract invariants, exercises public interaction API error
 * & unknown-herb behavior, queries NCBI E-utilities esummary across all cited
 * PubMed PMIDs to detect retracted publications, and probes unique non-PubMed
 * regulatory citation URLs.
 *
 * Usage:
 *   npx tsx scripts/verify-open-data-and-sources.ts [--base-url https://herbally.app] [--json-out report.json]
 */

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

async function fetchJson<T>(url: string): Promise<{ res: Response; data: T }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  const data = (await res.json()) as T;
  return { res, data };
}

function extractPmid(url: string): string | null {
  const match = /^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)\/?$/i.exec(
    url.trim()
  );
  return match ? match[1] : null;
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

async function probeUrl(
  url: string
): Promise<
  | { kind: "ok"; status: number }
  | { kind: "blocked"; status: number }
  | { kind: "broken"; reason: string }
> {
  for (const method of ["HEAD", "GET"] as const) {
    try {
      const res = await fetch(url, {
        method,
        redirect: "follow",
        headers: {
          "User-Agent":
            "HerbAlly-SourceMonitor/1.0 (+https://herbally.app/trust)",
        },
        signal: AbortSignal.timeout(12_000),
      });
      if (res.status >= 200 && res.status < 400) {
        return { kind: "ok", status: res.status };
      }
      if (method === "HEAD" && res.status === 405) {
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
    } catch (err) {
      if (method === "GET") {
        return {
          kind: "broken",
          reason: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }
  return { kind: "broken", reason: "unreachable" };
}

async function main() {
  const baseUrl = (parseArg("--base-url") ?? "https://herbally.app").replace(
    /\/+$/,
    ""
  );
  const jsonOut = parseArg("--json-out");

  const [catalogR, medsR, ixR, qR, schemaR] = await Promise.all([
    fetchJson<{
      datasetVersion: string;
      snapshotId: string;
      generatedAt: string;
      counts: Record<string, number>;
    }>(`${baseUrl}/open-data/catalog.json`),
    fetchJson<{
      datasetVersion: string;
      snapshotId: string;
      generatedAt: string;
      totalMedications: number;
      totalInteractionPairs: number;
    }>(`${baseUrl}/open-data/medications.json`),
    fetchJson<{
      datasetVersion: string;
      snapshotId: string;
      generatedAt: string;
      totalPairs: number;
      clinicianSignedPairs: number;
      interactions: Array<{ sourceUrl: string | null }>;
    }>(`${baseUrl}/open-data/interactions.json`),
    fetchJson<{
      datasetVersion: string;
      snapshotId: string;
      generatedAt: string;
      totalQuarantinedBotanicals: number;
    }>(`${baseUrl}/open-data/quarantine.json`),
    fetchJson<{
      openapi: string;
      info: { version: string };
      paths: Record<string, unknown>;
    }>(`${baseUrl}/open-data/schema.json`),
  ]);

  for (const r of [catalogR, medsR, ixR, qR, schemaR]) {
    if (r.res.headers.get("access-control-allow-origin") !== "*") {
      throw new Error(`Missing CORS * header on ${r.res.url}`);
    }
  }

  const snapshotId = catalogR.data.snapshotId;
  if (
    medsR.data.snapshotId !== snapshotId ||
    ixR.data.snapshotId !== snapshotId ||
    qR.data.snapshotId !== snapshotId
  ) {
    throw new Error(
      `Snapshot mismatch: catalog=${snapshotId}, meds=${medsR.data.snapshotId}, ix=${ixR.data.snapshotId}, q=${qR.data.snapshotId}`
    );
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
  const brokenUrls: Array<{ url: string; reason: string }> = [];

  for (const url of uniqueUrls) {
    if (!url.startsWith("https://")) {
      brokenUrls.push({ url, reason: "Non-HTTPS source URL" });
      continue;
    }
    const pmid = extractPmid(url);
    if (pmid) pmids.push(pmid);
    else nonPubmedUrls.push(url);
  }

  const retractedPmids = await checkRetractedPmids(pmids);
  const botBlocked: Array<{ url: string; status: number }> = [];
  let nonPubmedOk = 0;

  for (let i = 0; i < nonPubmedUrls.length; i += 4) {
    const batch = nonPubmedUrls.slice(i, i + 4);
    const outcomes = await Promise.all(
      batch.map(async (u) => ({ url: u, result: await probeUrl(u) }))
    );
    for (const { url, result } of outcomes) {
      if (result.kind === "ok") nonPubmedOk += 1;
      else if (result.kind === "blocked") {
        botBlocked.push({ url, status: result.status });
      } else {
        brokenUrls.push({ url, reason: result.reason });
      }
    }
  }

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
      brokenUrls,
    },
  };

  if (jsonOut) {
    fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2) + "\n");
  }
  console.log(JSON.stringify(report, null, 2));

  if (retractedPmids.length > 0 || brokenUrls.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
