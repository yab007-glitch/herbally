/**
 * Cross-reference every published herb's scientific name against GBIF.
 *
 * GBIF's backbone taxonomy is CC BY 4.0 — commercial use permitted with
 * attribution — and it answers the only question that matters for accuracy
 * here: is the name we print a current, accepted name for a real plant, or is
 * it a synonym, a misspelling, or nothing at all?
 *
 * It does not edit anything. Every flag needs a human decision, because a
 * "synonym" is sometimes the name the literature actually uses.
 *
 * Usage: node scripts/crossref-gbif.mjs [--limit N]
 * Output: artifacts/gbif-crossref.json + a triage summary on stdout.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, "artifacts", "gbif-crossref.json");
const API = "https://api.gbif.org/v1/species/match";
const CONCURRENCY = 8;

const argLimit = (() => {
  const i = process.argv.indexOf("--limit");
  return i >= 0 ? Number(process.argv[i + 1]) || 0 : 0;
})();

function env() {
  const out = {};
  for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const norm = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

async function getHerbs() {
  const e = env();
  const headers = { apikey: e.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${e.NEXT_PUBLIC_SUPABASE_ANON_KEY}` };
  const rows = [];
  for (let off = 0; ; off += 1000) {
    const url = `${e.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/herbs?select=slug,name,scientific_name&is_published=eq.true&order=slug&limit=1000&offset=${off}`;
    const res = await fetch(url, { headers });
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

async function match(name, attempt = 1) {
  const url = `${API}?name=${encodeURIComponent(name)}&kingdom=Plantae`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "HerbAlly data importer (herbally.app)" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (attempt >= 3) return { error: err.message };
    await new Promise((r) => setTimeout(r, 800 * attempt));
    return match(name, attempt + 1);
  }
}

function classify(herb, m) {
  if (m.error) return { kind: "error", detail: m.error };
  if (!m.usageKey || m.matchType === "NONE") return { kind: "not_found", detail: "GBIF has no match" };

  const ours = norm(herb.scientific_name);
  const canonical = norm(m.canonicalName || m.scientificName);
  const accepted = norm(m.acceptedName || "");
  const confidence = m.confidence ?? 0;

  // GBIF marks a name SYNONYM even when the accepted name is the same taxon
  // with an author citation stripped ("Acacia senegal (L.) Willd." → "Acacia
  // senegal"). Only a change in genus or species is a real synonym.
  const binom = (v) => norm(v).split(" ").slice(0, 2).join(" ");
  const acceptedBinom = binom(m.acceptedName || m.canonicalName);
  if (m.status === "SYNONYM" && acceptedBinom && acceptedBinom !== binom(herb.scientific_name)) {
    return { kind: "synonym", detail: `GBIF: "${herb.scientific_name}" is a synonym of "${m.acceptedName || m.canonicalName}"` };
  }
  // A single-word canonicalName means GBIF only reached genus level.
  if (m.canonicalName && !m.canonicalName.trim().includes(" ")) {
    return { kind: "name_mismatch", detail: `GBIF matched only the genus "${m.canonicalName}" for "${herb.scientific_name}"` };
  }
  if (confidence < 90) return { kind: "low_confidence", detail: `confidence ${confidence} → ${m.canonicalName}` };
  if (canonical && canonical !== ours) {
    // Compare only genus + species; infraspecific ranks are fine.
    const a = ours.split(" ").slice(0, 2).join(" ");
    const b = canonical.split(" ").slice(0, 2).join(" ");
    if (a !== b) return { kind: "name_mismatch", detail: `ours "${herb.scientific_name}" vs GBIF "${m.canonicalName}"${accepted ? ` (accepted: ${m.acceptedName})` : ""}` };
  }
  return { kind: "ok", detail: `${m.status || "ACCEPTED"} ${m.canonicalName}` };
}

async function main() {
  const herbs = await getHerbs();
  const list = argLimit ? herbs.slice(0, argLimit) : herbs;
  console.log(`[gbif] ${list.length} published herbs to check`);

  const results = [];
  let i = 0;
  async function worker() {
    while (i < list.length) {
      const herb = list[i++];
      const m = await match(herb.scientific_name);
      results.push({ slug: herb.slug, name: herb.name, scientific_name: herb.scientific_name, ...classify(herb, m), raw: { status: m.status, confidence: m.confidence, canonicalName: m.canonicalName, acceptedName: m.acceptedName } });
      if (results.length % 250 === 0) console.log(`[gbif] ${results.length}/${list.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const counts = {};
  for (const r of results) counts[r.kind] = (counts[r.kind] || 0) + 1;
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ generated_at: new Date().toISOString(), source: "GBIF species/match (CC BY 4.0)", total: results.length, counts, results }, null, 1));
  console.log("[gbif] done:", JSON.stringify(counts));
  for (const kind of ["not_found", "synonym", "name_mismatch", "low_confidence"]) {
    const sample = results.filter((r) => r.kind === kind).slice(0, 6);
    if (sample.length) {
      console.log(`\n--- ${kind} (${counts[kind]}) ---`);
      for (const s of sample) console.log(`  ${s.slug} | ${s.scientific_name} | ${s.detail}`);
    }
  }
}

main().catch((e) => {
  console.error("[gbif] fatal:", e.message);
  process.exit(1);
});
