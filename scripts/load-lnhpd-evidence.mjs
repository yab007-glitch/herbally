/**
 * Load the reviewed LNHPD enrichment artifact into `herb_regulatory_evidence`.
 *
 * Writes with the service-role key from .env.local (server-side only; the key is
 * never printed). The table is public-read, service-write: RLS allows anon SELECT
 * and nothing else.
 *
 * Idempotent: upserts on herb_slug, so re-running after a new harvest refreshes
 * rows instead of duplicating them.
 *
 * Usage: node scripts/load-lnhpd-evidence.mjs [--dry-run]
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ARTIFACT = join(ROOT, "artifacts", "lnhpd-enrichment.json");
const DRY = process.argv.includes("--dry-run");
const BATCH = 100;

function env() {
  const text = readFileSync(join(ROOT, ".env.local"), "utf8");
  const out = {};
  for (const line of text.split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

async function main() {
  const e = env();
  const url = e.NEXT_PUBLIC_SUPABASE_URL;
  const key = e.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  if (!existsSync(ARTIFACT)) throw new Error("missing artifacts/lnhpd-enrichment.json — run scripts/enrich-lnhpd.mjs");

  const herbs = JSON.parse(readFileSync(ARTIFACT, "utf8")).herbs;
  const rows = Object.entries(herbs).map(([slug, h]) => ({
    herb_slug: slug,
    source: h.source || "Health Canada LNHPD",
    source_licence: h.source_licence || "canada-ogl",
    purposes: h.purposes || [],
    doses: h.doses || [],
    risks: h.risks || [],
    products_sampled: h.products_sampled || 0,
    source_urls: h.sources || [],
    retrieved_at: h.retrieved_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  // A row with no quoted statement is not evidence; drop it rather than store
  // an empty shell that a page could render as "regulator-reviewed".
  const keep = rows.filter((r) => r.purposes.length || r.doses.length || r.risks.length);
  console.log(`[load] ${rows.length} herbs in artifact, ${keep.length} with at least one statement`);
  if (DRY) {
    console.log("[load] dry run — nothing written");
    return;
  }

  let written = 0;
  for (let i = 0; i < keep.length; i += BATCH) {
    const chunk = keep.slice(i, i + BATCH);
    const res = await fetch(`${url}/rest/v1/herb_regulatory_evidence`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`upsert failed at offset ${i}: ${res.status} ${body.slice(0, 300)}`);
    }
    written += chunk.length;
    if (written % 500 === 0) console.log(`[load] ${written}/${keep.length}`);
  }

  const countRes = await fetch(`${url}/rest/v1/herb_regulatory_evidence?select=herb_slug`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact", Range: "0-0" },
  });
  const range = countRes.headers.get("content-range") || "";
  console.log(`[load] done. written ${written} | table now holds ${range.split("/")[1] || "?"} rows`);
}

main().catch((err) => {
  console.error("[load] fatal:", err.message);
  process.exit(1);
});
