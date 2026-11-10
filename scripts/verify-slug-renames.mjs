/**
 * Readiness gate for the staged herb slug renames.
 *
 * Reads data/herb-slug-renames.json and checks the live `herbs` table through
 * PostgREST, using the service role key from .env.local the same way
 * scripts/apply-name-corrections.mjs does. A rename is ready when the
 * destination slug has a row and it is published, and the source slug no
 * longer has a row.
 *
 * Default mode prints the readiness table and exits 0. `--require-ready` turns
 * the same table into a gate: it exits 1 unless every rename is ready. Run the
 * gate before activating the redirects, and ship the database rename in the
 * same deploy.
 *
 * This script never writes.
 *
 * Usage:
 *   node scripts/verify-slug-renames.mjs
 *   node scripts/verify-slug-renames.mjs --require-ready
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const MANIFEST = join(ROOT, "data", "herb-slug-renames.json");
const REQUIRE_READY = process.argv.includes("--require-ready");

function env() {
  const out = {};
  for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split(
    "\n"
  )) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const e = env();
const HEAD = {
  apikey: e.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}`,
};
const REST = `${e.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/herbs`;

const slugOf = (path) => path.replace(/^\/herbs\//, "");

async function getRows(slug) {
  const res = await fetch(
    `${REST}?slug=eq.${encodeURIComponent(slug)}&select=slug,is_published`,
    { headers: HEAD }
  );
  if (!res.ok)
    throw new Error(`read ${slug} failed: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  if (!Array.isArray(rows))
    throw new Error(`read ${slug} returned a non-array body`);
  return rows;
}

async function main() {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const renames = manifest.renames || [];

  console.log(
    `[renames] ${renames.length} staged renames, ${manifest.activation || "unknown"} activation${REQUIRE_READY ? " (require ready)" : ""}`
  );

  const table = [];
  const notReady = [];

  for (const rename of renames) {
    const sourceSlug = slugOf(rename.from);
    const destSlug = slugOf(rename.to);
    const sourceRows = await getRows(sourceSlug);
    const destRows = await getRows(destSlug);

    const sourcePresent = sourceRows.length > 0;
    const destPresent = destRows.length > 0;
    const destPublished = destRows.some((row) => row.is_published === true);
    const ready = !sourcePresent && destPresent && destPublished;

    table.push({
      from: rename.from,
      source_row: sourcePresent ? "present" : "absent",
      destination_row: destPresent ? "present" : "absent",
      destination_published: destPublished ? "yes" : "no",
      ready: ready ? "yes" : "NO",
    });
    if (!ready) notReady.push(rename.from);
  }

  console.table(table);
  console.log(
    `[renames] ${renames.length - notReady.length}/${renames.length} ready`
  );

  if (!REQUIRE_READY) {
    console.log("[renames] readiness report only; nothing was written");
    return;
  }

  if (notReady.length) {
    console.error(`\n[renames] NOT READY - ${notReady.length} rename(s)`);
    for (const from of notReady) console.error(`  - ${from}`);
    process.exit(1);
  }

  console.log("[renames] OK - every rename is ready to activate");
}

main().catch((err) => {
  console.error("[renames] fatal:", err.message);
  process.exit(1);
});
