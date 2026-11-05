#!/usr/bin/env node
/**
 * Fill `herbs.related_slugs` so every page can link to its neighbours without a
 * query at render time.
 *
 * Two kinds of neighbour, both defensible:
 *   1. same genus — a reader looking at Curcuma longa may want the other Curcuma
 *      species in the library
 *   2. shared indication — the first traditional use, matched exactly
 *
 * Only published herbs are ever linked to, never itself, and the list is capped so
 * the block stays compact. The result is stored on the row, so ISR renders stay
 * single-query.
 *
 * Usage: node scripts/build-related-herbs.mjs [--apply]
 */
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname;
const env = {};
for (const line of readFileSync(`${ROOT}.env.local`, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};
const APPLY = process.argv.includes("--apply");
const PER_REASON = 3;
const MAX = 6;

const genusOf = (sci) =>
  (
    String(sci || "")
      .trim()
      .split(/\s+/)[0] || ""
  ).toLowerCase();
/**
 * Only a specific indication counts as a match. Short strings like "digestive"
 * matched half the library and produced nonsense neighbours.
 */
const useKey = (uses) => {
  const first = (uses || [])
    .map((u) =>
      String(u)
        .toLowerCase()
        .replace(/[^a-z ]/g, "")
        .trim()
    )
    .find((u) => u.length > 40);
  return first || "";
};

async function main() {
  const herbs = [];
  for (let off = 0; ; off += 1000) {
    const r = await fetch(
      `${BASE}/rest/v1/herbs?select=id,slug,scientific_name,traditional_uses&is_published=eq.true&limit=1000&offset=${off}`,
      { headers: H }
    );
    const page = await r.json();
    herbs.push(...page);
    if (page.length < 1000) break;
  }
  console.log(`[links] ${herbs.length} published herbs`);

  const byGenus = new Map();
  const byUse = new Map();
  for (const h of herbs) {
    const g = genusOf(h.scientific_name);
    if (g) byGenus.set(g, [...(byGenus.get(g) || []), h]);
    const u = useKey(h.traditional_uses);
    if (u) byUse.set(u, [...(byUse.get(u) || []), h]);
  }

  const plan = [];
  for (const h of herbs) {
    const picks = [];
    const push = (slug) => {
      if (slug !== h.slug && !picks.includes(slug) && picks.length < MAX)
        picks.push(slug);
    };
    // closest relations first: same genus, other species
    for (const sib of (byGenus.get(genusOf(h.scientific_name)) || []).slice(
      0,
      PER_REASON + 1
    ))
      push(sib.slug);
    // then herbs that claim the same leading indication
    for (const sib of (byUse.get(useKey(h.traditional_uses)) || []).slice(
      0,
      PER_REASON + 1
    ))
      push(sib.slug);
    plan.push({ id: h.id, slug: h.slug, related: picks });
  }

  const withLinks = plan.filter((p) => p.related.length).length;
  console.log(
    `[links] ${withLinks}/${plan.length} herbs get at least one neighbour${APPLY ? "" : " (dry run)"}`
  );
  if (!APPLY) {
    for (const p of plan.filter((x) => x.related.length).slice(0, 4)) {
      console.log(`  ${p.slug} -> ${p.related.join(", ")}`);
    }
    writeFileSync(
      `${ROOT}artifacts/related-herbs-plan.json`,
      JSON.stringify(plan.slice(0, 500), null, 1)
    );
    return;
  }

  let ok = 0;
  let n = 0;
  for (const p of plan) {
    if (!p.related.length) continue;
    n++;
    if (n % 100 === 0) {
      console.log(`[links] ${n} written`);
      await new Promise((r) => setTimeout(r, 1500));
    }
    const patch = await fetch(`${BASE}/rest/v1/herbs?id=eq.${p.id}`, {
      method: "PATCH",
      headers: { ...H, Prefer: "return=minimal" },
      body: JSON.stringify({ related_slugs: p.related }),
    });
    if (!patch.ok) continue;
    // PostgREST answers 204 even when nothing matched, so read it back.
    const check = await fetch(
      `${BASE}/rest/v1/herbs?select=related_slugs&id=eq.${p.id}`,
      { headers: H }
    );
    const rows = await check.json();
    if (rows[0]?.related_slugs) ok++;
  }
  console.log(`[links] verified writes: ${ok}/${plan.length}`);
}

main().catch((e) => {
  console.error("[links] fatal:", e.message);
  process.exit(1);
});
