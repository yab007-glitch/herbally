/**
 * The guard and the applier must agree on what a phantom second source is.
 * This test drives both scripts against one in-memory table through a stubbed
 * fetch: the applier repairs every shape, the guard then reports none, and a
 * second dry run converges to zero updates.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { main as applyNameCorrections } from "../apply-name-corrections.mjs";
import { main as verifyHerbFacts } from "../verify-herb-facts.mjs";
import {
  hasCurrentNameDrift,
  hasPhantomSecondSource,
} from "../lib/herb-taxonomy.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const MANIFEST = JSON.parse(
  readFileSync(join(ROOT, "..", "data", "herb-name-corrections.json"), "utf8")
);

process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://stub.local";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-role-key";

const applied = MANIFEST.applied || [];
const alignments = new Map(
  (MANIFEST.display_name_alignments || []).map((a) => [a.slug, a])
);
const secondPass = new Map(
  (MANIFEST.ncbi_second_pass || []).map((r) => [r.slug, r])
);
const manifestBySlug = new Map(applied.map((e) => [e.slug, e]));

const targetName = (entry) => entry.new_name ?? entry.gbif;

/** Mirrors the applier's second-source resolution, including its all-null drop. */
function secondSource(entry) {
  let record = null;
  if (entry.second_source) {
    record = {
      name: entry.second_source.ncbi_name ?? null,
      taxid: entry.second_source.taxid ?? null,
    };
  } else {
    const pass = secondPass.get(entry.slug);
    if (pass) {
      record = { name: pass.ncbi_name ?? null, taxid: pass.ncbi_taxid ?? null };
    }
  }
  if (!record || (record.name == null && record.taxid == null)) return null;
  return record;
}

function correctTaxonomy(entry, target) {
  const second = secondSource(entry);
  return {
    source: "GBIF Backbone Taxonomy",
    licence: "CC BY 4.0",
    checked_at: "2026-01-01",
    verified_at: "2026-01-01",
    source_url: `https://www.gbif.org/species/search?q=${encodeURIComponent(target)}`,
    current_name: target,
    previous_name: entry.ours,
    verification: "single_source",
    second_source: second ? "NCBI Taxonomy" : null,
    second_source_name: second?.name ?? null,
    second_source_taxid: second?.taxid ?? null,
  };
}

const EMPTY_STRING_SLUG = "triphala-digestive";
const NULL_NAME_SLUG = "fumitory-common";
const CORRECT_SLUG = "herb-bennet";
const STALE_SLUG = "clivers-goosegrass";
const REPAIR_SLUGS = [EMPTY_STRING_SLUG, NULL_NAME_SLUG, STALE_SLUG];

function buildTable() {
  const table = new Map();

  for (const entry of applied) {
    const target = targetName(entry);
    const alignment = alignments.get(entry.slug);
    // Every row already carries its corrected name, so the applier has no
    // scientific_name or display work to do and only taxonomy can change.
    table.set(entry.slug, {
      slug: entry.slug,
      scientific_name: target,
      name: alignment ? alignment.new_name : target,
      provenance: {
        taxonomy: correctTaxonomy(entry, target),
      },
      is_published: true,
    });
  }

  table.get(EMPTY_STRING_SLUG).provenance.taxonomy = {
    ...correctTaxonomy(
      manifestBySlug.get(EMPTY_STRING_SLUG),
      targetName(manifestBySlug.get(EMPTY_STRING_SLUG))
    ),
    second_source: "NCBI Taxonomy",
    second_source_name: "",
    second_source_taxid: null,
  };

  table.get(NULL_NAME_SLUG).provenance.taxonomy = {
    ...correctTaxonomy(
      manifestBySlug.get(NULL_NAME_SLUG),
      targetName(manifestBySlug.get(NULL_NAME_SLUG))
    ),
    second_source: "NCBI Taxonomy",
    second_source_name: null,
    second_source_taxid: null,
  };

  table.get(STALE_SLUG).provenance.taxonomy = {
    ...correctTaxonomy(
      manifestBySlug.get(STALE_SLUG),
      targetName(manifestBySlug.get(STALE_SLUG))
    ),
    current_name: manifestBySlug.get(STALE_SLUG).ours,
  };

  return table;
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function decodeSlug(value) {
  return value.replace(/^eq\./, "");
}

function installFetch(table) {
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.pathname !== "/rest/v1/herbs") {
      throw new Error(`unexpected fetch: ${url.pathname}`);
    }
    const method = String(init.method || "GET").toUpperCase();

    if (method === "PATCH") {
      const slug = decodeSlug(url.searchParams.get("slug"));
      const row = table.get(slug);
      if (!row) throw new Error(`PATCH for unknown slug ${slug}`);
      Object.assign(row, JSON.parse(init.body));
      return jsonResponse(null, 204);
    }

    if (method !== "GET") throw new Error(`unexpected method ${method}`);

    const slugParam = url.searchParams.get("slug");
    if (slugParam !== null) {
      const row = table.get(decodeSlug(slugParam));
      return jsonResponse(row ? [row] : []);
    }

    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? 1000);
    const rows = [...table.values()]
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .slice(offset, offset + limit)
      .map((row) => ({
        slug: row.slug,
        scientific_name: row.scientific_name,
        provenance: row.provenance,
        is_published: row.is_published,
      }));
    return jsonResponse(rows);
  };
}

const taxonomyUpdates = (result) =>
  result.table
    .filter((row) => row.field === "provenance.taxonomy")
    .map((row) => row.slug);

const savedFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = savedFetch;
});

describe("taxonomy provenance repair", () => {
  it("repairs the empty-string and null shapes and converges", async () => {
    const table = buildTable();
    installFetch(table);

    const dryRun = await applyNameCorrections({ apply: false });
    expect(taxonomyUpdates(dryRun).sort()).toEqual([...REPAIR_SLUGS].sort());
    expect(taxonomyUpdates(dryRun)).toHaveLength(REPAIR_SLUGS.length);
    expect(taxonomyUpdates(dryRun)).not.toContain(CORRECT_SLUG);
    expect(dryRun.taxonomyUpdates).toBe(REPAIR_SLUGS.length);
    expect(dryRun.scientificUpdates).toBe(0);
    expect(dryRun.displayUpdates).toBe(0);
    expect(dryRun.failures).toEqual([]);

    const appliedRun = await applyNameCorrections({ apply: true });
    expect(taxonomyUpdates(appliedRun).sort()).toEqual(
      [...REPAIR_SLUGS].sort()
    );
    expect(taxonomyUpdates(appliedRun)).toHaveLength(REPAIR_SLUGS.length);
    expect(taxonomyUpdates(appliedRun)).not.toContain(CORRECT_SLUG);
    expect(appliedRun.taxonomyUpdates).toBe(REPAIR_SLUGS.length);
    expect(appliedRun.failures).toEqual([]);

    const repaired = table.get(EMPTY_STRING_SLUG).provenance.taxonomy;
    expect(repaired.second_source_name).toBeNull();
    expect(repaired.second_source_name).not.toBe("");
    expect(repaired.second_source_taxid).toBeNull();

    const guard = await verifyHerbFacts();
    expect(guard.phantomSecondSource).toEqual([]);
    expect(guard.currentNameDrift).toEqual([]);
    expect(guard.unsourced).toEqual([]);

    const secondDryRun = await applyNameCorrections({ apply: false });
    expect(secondDryRun.taxonomyUpdates).toBe(0);
    expect(taxonomyUpdates(secondDryRun)).toEqual([]);
  });

  it("shares the guard's definition of empty-string and null sources", () => {
    expect(
      hasPhantomSecondSource({
        second_source: "NCBI Taxonomy",
        second_source_name: "",
        second_source_taxid: null,
      })
    ).toBe(true);
    expect(
      hasPhantomSecondSource({
        second_source: "NCBI Taxonomy",
        second_source_name: null,
        second_source_taxid: null,
      })
    ).toBe(true);
    expect(
      hasPhantomSecondSource({
        second_source: "NCBI Taxonomy",
        second_source_name: "Galium aparine",
        second_source_taxid: "29788",
      })
    ).toBe(false);
    expect(
      hasCurrentNameDrift(
        { current_name: "Galium aparine var." },
        "Galium aparine"
      )
    ).toBe(true);
    expect(hasCurrentNameDrift({ current_name: null }, "Galium aparine")).toBe(
      false
    );
    expect(hasCurrentNameDrift(null, "Galium aparine")).toBe(false);
  });
});
