#!/usr/bin/env tsx
/**
 * mark-herb-provenance — one-shot CLI to record/refresh the provenance
 * record on a herb row. Idempotent: running twice updates `last_verified_at`
 * and merges sources without duplicating them.
 *
 * Usage:
 *   npx tsx scripts/mark-herb-provenance.ts <slug>
 *     --method manual
 *     --sources "WHO,NCCIH"
 *     --primary-url https://nccih.nih.gov/health/ginger
 *     --verified-by "Dr. Smith"
 *     --notes "Cross-checked WHO monograph 2024 edition p.12"
 *
 *   npx tsx scripts/mark-herb-provenance.ts --csv reviewed.csv
 *
 *   # clear provenance (back to unverified)
 *   npx tsx scripts/mark-herb-provenance.ts <slug> --clear
 *
 * CSV columns: slug,verification_method,sources,primary_url,verified_by,notes
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";

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
  if (!["manual", "ai_summarized", "primary_source", "unverified"].includes(method)) {
    throw new Error(`Invalid --method "${method}"`);
  }
  return {
    verification_method: method,
    sources: parseSources(getArg("sources")),
    primary_url: getArg("primary-url"),
    last_verified_at: new Date().toISOString(),
    verified_by: getArg("verified-by"),
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
    throw new Error(`Herb not found: ${slug} (${fetchErr?.message ?? "no row"})`);
  }

  const existing = (data.provenance as Record<string, unknown> | null) ?? {};
  const existingSources = Array.isArray(existing.sources) ? (existing.sources as string[]) : [];
  const mergedSources = Array.from(new Set([...existingSources, ...update.sources]));

  const next = {
    ...existing,
    verification_method: update.verification_method,
    sources: mergedSources,
    primary_url: update.primary_url ?? existing.primary_url ?? null,
    last_verified_at: update.last_verified_at,
    verified_by: update.verified_by ?? existing.verified_by ?? null,
    ...(update.notes ? { notes: update.notes } : {}),
  };

  const { error: updateErr } = await supabase
    .from("herbs")
    .update({ provenance: next })
    .eq("id", data.id);

  if (updateErr) {
    throw new Error(`Update failed: ${updateErr.message}`);
  }
  // eslint-disable-next-line no-console
  console.log(`✓ ${slug} → ${update.verification_method} (${mergedSources.length} sources)`);
}

async function clearProvenance(supabase: ReturnType<typeof getSupabase>, slug: string) {
  const { data, error: fetchErr } = await supabase
    .from("herbs")
    .select("id")
    .eq("slug", slug)
    .single();
  if (fetchErr || !data) throw new Error(`Herb not found: ${slug}`);
  const { error: updateErr } = await supabase
    .from("herbs")
    .update({ provenance: {} })
    .eq("id", data.id);
  if (updateErr) throw new Error(updateErr.message);
  // eslint-disable-next-line no-console
  console.log(`✓ ${slug} cleared`);
}

async function main() {
  if (hasFlag("csv")) {
    // CSV bulk mode is optional and requires `csv-parse` as a devDependency.
    // To enable: `pnpm add -D csv-parse` and uncomment the block below.
    // The slug-based mode above covers the common case (one-off review of a
    // single herb after looking up a primary source).
    throw new Error(
      "CSV mode is not enabled. Run per-slug, or install csv-parse and re-enable."
    );
  }

  const slug = process.argv[2];
  if (!slug || slug.startsWith("--")) {
    throw new Error("Pass a slug as the first positional argument, or use --csv <file>");
  }
  const supabase = getSupabase();
  if (hasFlag("clear")) {
    await clearProvenance(supabase, slug);
    return;
  }
  await mergeProvenance(supabase, slug, buildUpdate());
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`✗ ${err.message ?? err}`);
  process.exit(1);
});
