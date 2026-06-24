#!/usr/bin/env tsx
/**
 * mark-herb-provenance — CLI to record/refresh the provenance record on herb
 * rows. Supports per-slug mode (--method, --sources, …) and CSV bulk mode
 * (--csv <file.csv>). Idempotent: merges sources, bumps last_verified_at.
 *
 * Per-slug usage:
 *   npx tsx scripts/mark-herb-provenance.ts <slug>
 *     --method manual
 *     --sources "WHO,NCCIH"
 *     --primary-url https://nccih.nih.gov/health/ginger
 *     --verified-by "Dr. Smith"
 *     --notes "Cross-checked WHO monograph 2024 edition p.12"
 *
 * CSV bulk mode:
 *   npx tsx scripts/mark-herb-provenance.ts --csv reviewed.csv
 *
 *   # dry-run first (no writes)
 *   npx tsx scripts/mark-herb-provenance.ts --csv reviewed.csv --dry-run
 *
 *   # clear provenance (back to unverified)
 *   npx tsx scripts/mark-herb-provenance.ts <slug> --clear
 *
 * CSV columns (header row required):
 *   slug,verification_method,sources,primary_url,verified_by,notes
 *
 *   Example CSV:
 *     slug,verification_method,sources,primary_url,verified_by,notes
 *     ginger,manual,"WHO,NCCIH",https://...,Dr. Smith,"Monograph p.12"
 *     turmeric,primary_source,EMA,https://...,Dr. Jones,
 *     echinacea,manual,NCCIH,https://...,,
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

type Method = "manual" | "ai_summarized" | "primary_source" | "unverified";

function getArg(name: string): string | null {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx < 0) return null;
  return process.argv[idx + 1] ?? null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function parseSources(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in .env.local."
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type ProvenanceUpdate = {
  verification_method: Method;
  sources: string[];
  primary_url: string | null;
  last_verified_at: string;
  verified_by: string | null;
  notes?: string;
};

function buildUpdate(): ProvenanceUpdate {
  const method = (getArg("method") as Method | null) ?? "manual";
  if (
    !["manual", "ai_summarized", "primary_source", "unverified"].includes(
      method
    )
  ) {
    throw new Error(`Invalid --method "${method}"`);
  }
  return {
    verification_method: method,
    sources: parseSources(getArg("sources")),
    primary_url: getArg("primary-url") || null,
    last_verified_at: new Date().toISOString(),
    verified_by: getArg("verified-by") || null,
    notes: getArg("notes") ?? undefined,
  };
}

async function mergeProvenance(
  supabase: ReturnType<typeof getSupabase>,
  slug: string,
  update: ProvenanceUpdate
) {
  const { data, error: fetchErr } = await supabase
    .from("herbs")
    .select("id, slug, provenance")
    .eq("slug", slug)
    .single();

  if (fetchErr || !data) {
    throw new Error(
      `Herb not found: ${slug} (${fetchErr?.message ?? "no row"})`
    );
  }

  const existing = (data.provenance as Record<string, unknown> | null) ?? {};
  const existingSources = Array.isArray(existing.sources)
    ? (existing.sources as string[])
    : [];
  const mergedSources = Array.from(
    new Set([...existingSources, ...update.sources])
  );

  const next = {
    ...existing,
    verification_method: update.verification_method,
    sources: mergedSources,
    primary_url: update.primary_url ?? existing.primary_url ?? null,
    last_verified_at: update.last_verified_at,
    verified_by: update.verified_by ?? existing.verified_by ?? null,
    ...(update.notes ? { notes: update.notes } : {}),
  };

  // A named reviewer on a human-verified method (manual / primary_source)
  // must also stamp the `reviewed_by` and `last_reviewed` columns — the herb
  // page reads those (not provenance.verified_by) to render "Reviewed by …"
  // attribution. Without this, marking provenance alone never surfaced the
  // reviewer on the page. Store the DISPLAY NAME (e.g. "Dr. Dawn Wong") so
  // every renderer shows a human-readable name; the UI reviewer registry
  // resolves it back to a linked, credentialed profile.
  const isHumanVerified =
    update.verification_method === "manual" ||
    update.verification_method === "primary_source";
  const columnUpdate: Record<string, unknown> = { provenance: next };
  if (isHumanVerified && update.verified_by) {
    columnUpdate.reviewed_by = update.verified_by;
    columnUpdate.last_reviewed = update.last_verified_at;
  } else if (!isHumanVerified) {
    // Non-verified methods are not human-reviewed — clear stale attribution.
    columnUpdate.reviewed_by = null;
    columnUpdate.last_reviewed = null;
  }

  const { error: updateErr } = await supabase
    .from("herbs")
    .update(columnUpdate)
    .eq("id", data.id);

  if (updateErr) {
    throw new Error(`Update failed: ${updateErr.message}`);
  }
  console.log(
    `✓ ${slug} → ${update.verification_method} (${mergedSources.length} sources)`
  );
}

async function clearProvenance(
  supabase: ReturnType<typeof getSupabase>,
  slug: string
) {
  const { data, error: fetchErr } = await supabase
    .from("herbs")
    .select("id")
    .eq("slug", slug)
    .single();
  if (fetchErr || !data) throw new Error(`Herb not found: ${slug}`);
  const { error: updateErr } = await supabase
    .from("herbs")
    .update({ provenance: {}, reviewed_by: null, last_reviewed: null })
    .eq("id", data.id);
  if (updateErr) throw new Error(updateErr.message);
  console.log(`✓ ${slug} cleared`);
}

// -------------------------------------------------------------------
// CSV bulk mode
// -------------------------------------------------------------------

interface CsvRow {
  slug: string;
  verification_method: Method;
  sources: string;
  primary_url: string;
  verified_by: string;
  notes: string;
}

/**
 * Parse a CSV file at the given path into an array of CsvRow objects.
 * Handles quoted fields, header row, and trims whitespace.
 */
function parseCsv(filePath: string): CsvRow[] {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`CSV file not found: ${fullPath}`);
  }

  const raw = fs.readFileSync(fullPath, "utf-8");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error("CSV must have a header row and at least one data row");
  }

  const headerLine = lines[0];
  if (!headerLine) throw new Error("Empty header row");
  const headers = parseCsvLine(headerLine);
  const expectedHeaders = [
    "slug",
    "verification_method",
    "sources",
    "primary_url",
    "verified_by",
    "notes",
  ];

  for (const h of expectedHeaders) {
    if (!headers.includes(h)) {
      throw new Error(
        `CSV missing expected column "${h}". Found: ${headers.join(", ")}`
      );
    }
  }

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? "").trim();
    });

    const method = row["verification_method"] as Method;
    if (
      !["manual", "ai_summarized", "primary_source", "unverified"].includes(
        method
      )
    ) {
      console.warn(
        `Row ${i + 1}: invalid verification_method "${method}" for "${row["slug"]}", skipping`
      );
      continue;
    }

    rows.push({
      slug: row["slug"],
      verification_method: method,
      sources: row["sources"] ?? "",
      primary_url: row["primary_url"] ?? "",
      verified_by: row["verified_by"] ?? "",
      notes: row["notes"] ?? "",
    });
  }

  return rows;
}

/**
 * Parse a single CSV line, respecting quoted fields (e.g. "WHO, NCCIH").
 * Handles double-quote escaping within quoted fields.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        // Check for escaped quote ("")
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

async function runCsv(
  csvPath: string,
  dryRun: boolean
): Promise<{ total: number; succeeded: number; failed: number }> {
  const rows = parseCsv(csvPath);
  const supabase = dryRun
    ? (null as unknown as ReturnType<typeof getSupabase>)
    : getSupabase();

  console.log(
    `${dryRun ? "[DRY RUN] " : ""}Processing ${rows.length} rows from ${csvPath}...`
  );

  let succeeded = 0;
  let failed = 0;

  for (const row of rows) {
    const update: ProvenanceUpdate = {
      verification_method: row.verification_method,
      sources: parseSources(row.sources || null),
      primary_url: row.primary_url || null,
      last_verified_at: new Date().toISOString(),
      verified_by: row.verified_by || null,
      notes: row.notes || undefined,
    };

    try {
      if (dryRun) {
        console.log(
          `  [DRY] ${row.slug} → ${update.verification_method} (${update.sources.length} sources)`
        );
        succeeded++;
      } else {
        await mergeProvenance(supabase, row.slug, update);
        succeeded++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ ${row.slug}: ${msg}`);
      failed++;
    }
  }

  return { total: rows.length, succeeded, failed };
}

// -------------------------------------------------------------------
// Main
// -------------------------------------------------------------------

async function main() {
  if (hasFlag("csv")) {
    const csvPath = getArg("csv");
    if (!csvPath) {
      throw new Error("--csv requires a file path: --csv reviewed.csv");
    }
    const dryRun = hasFlag("dry-run");
    const { total, succeeded, failed } = await runCsv(csvPath, dryRun);
    console.log(
      `\n${dryRun ? "[DRY RUN] " : ""}Done. ${succeeded}/${total} succeeded${failed > 0 ? `, ${failed} failed` : ""}.`
    );
    if (failed > 0 && !dryRun) process.exit(1);
    return;
  }

  const slug = process.argv[2];
  if (!slug || slug.startsWith("--")) {
    throw new Error(
      "Pass a slug as the first positional argument, or use --csv <file>"
    );
  }
  const supabase = getSupabase();
  if (hasFlag("clear")) {
    await clearProvenance(supabase, slug);
    return;
  }
  await mergeProvenance(supabase, slug, buildUpdate());
}

main().catch((err) => {
  console.error(`✗ ${err.message ?? err}`);
  process.exit(1);
});
