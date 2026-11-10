#!/usr/bin/env node
/**
 * Fix photos that show a plant but not the part the page is about.
 *
 * `hawthorn-flowers` was illustrated with a hawthorn fruit: right species, wrong
 * organ. For herbs whose name carries a part (leaf, root, bark, seed, fruit...),
 * this looks for a Commons file whose name contains that part as well as the plant,
 * and swaps only when such a file exists with an allowed licence.
 *
 * A whole-plant photo is not a defect, so nothing is replaced unless the search
 * returns a file that names the part. Better to keep a correct picture of the wrong
 * organ than to publish a decorative mismatch.
 *
 * Usage: node scripts/fix-herb-image-parts.mjs [--apply] [--limit N]
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
const UA = "HerbAlly/1.0 (https://herbally.app)";
const APPLY = process.argv.includes("--apply");
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  return i >= 0 ? Number(process.argv[i + 1]) || 0 : 0;
})();

const PARTS = {
  leaf: ["leaf", "leaves", "folium"],
  root: ["root", "radix"],
  flower: ["flower", "flos", "blossom"],
  seed: ["seed", "semen"],
  bark: ["bark", "cortex"],
  fruit: ["fruit", "fructus", "berry"],
  rhizome: ["rhizome", "rootstock"],
  peel: ["peel", "rind"],
  pollen: ["pollen"],
  stem: ["stem", "caulis"],
};
const ALLOWED =
  /^(cc0|cc[- ]by(-sa)?[- ]?\d|public domain|pd-|no restrictions)/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(host, params) {
  const qs = new URLSearchParams({
    format: "json",
    origin: "*",
    ...params,
  }).toString();
  const r = await fetch(`https://${host}/w/api.php?${qs}`, {
    headers: { "User-Agent": UA },
  });
  if (!r.ok) throw new Error(`${host} ${r.status}`);
  return r.json();
}

async function licenceInfo(fileName) {
  const j = await api("commons.wikimedia.org", {
    action: "query",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    titles: `File:${fileName}`,
  });
  const page = Object.values(j.query?.pages ?? {})[0];
  const info = page?.imageinfo?.[0];
  if (!info) return null;
  const meta = info.extmetadata ?? {};
  const strip = (v) =>
    (v?.value ?? "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  return {
    url: String(info.url || "").split("?")[0],
    page: info.descriptionurl,
    licence: strip(meta.LicenseShortName),
    licenceUrl: strip(meta.LicenseUrl),
    artist: strip(meta.Artist) || "Unknown",
  };
}

async function main() {
  const rows = [];
  for (let off = 0; ; off += 1000) {
    const r = await fetch(
      `${BASE}/rest/v1/herbs?select=id,slug,scientific_name,image_url,provenance&image_url=not.is.null&is_published=eq.true&limit=1000&offset=${off}`,
      { headers: H }
    );
    const page = await r.json();
    rows.push(...page);
    if (page.length < 1000) break;
  }

  const targets = [];
  for (const h of rows) {
    const slug = String(h.slug).toLowerCase();
    for (const [part, words] of Object.entries(PARTS)) {
      // Plurals matter: "hawthorn-flowers" was skipped because the slug says
      // "flowers" and the pattern only matched "flower".
      if (!new RegExp(`(^|-)${part}s?(-|$)`).test(slug)) continue;
      const fname = (h.image_url || "").split("/").pop().toLowerCase();
      if (!words.some((w) => fname.includes(w)))
        targets.push({ herb: h, part, words });
      break;
    }
  }
  const work = LIMIT ? targets.slice(0, LIMIT) : targets;
  console.log(`[parts] ${work.length} candidates${APPLY ? "" : " (dry run)"}`);

  const report = [];
  for (const { herb, part, words } of work) {
    const genus = String(herb.scientific_name || "").split(/\s+/)[0];
    let j;
    try {
      j = await api("commons.wikimedia.org", {
        action: "query",
        list: "search",
        srsearch: `filetype:bitmap ${herb.scientific_name} ${part}`,
        srnamespace: "6",
        srlimit: "6",
      });
    } catch (e) {
      report.push({ slug: herb.slug, status: `search failed: ${e.message}` });
      await sleep(900);
      continue;
    }
    await sleep(900);
    const hit = (j.query?.search ?? []).find((s) => {
      const t = String(s.title || "").toLowerCase();
      return (
        t.includes(genus.toLowerCase()) && words.some((w) => t.includes(w))
      );
    });
    if (!hit) {
      report.push({ slug: herb.slug, part, status: "no part-specific file" });
      continue;
    }
    const file = String(hit.title).replace(/^File:/, "");
    let info = null;
    try {
      info = await licenceInfo(file);
    } catch (e) {
      report.push({
        slug: herb.slug,
        part,
        status: `licence failed: ${e.message}`,
      });
      await sleep(900);
      continue;
    }
    await sleep(900);
    if (!info || !ALLOWED.test(info.licence)) {
      report.push({
        slug: herb.slug,
        part,
        status: `licence refused: ${info?.licence ?? "none"}`,
      });
      continue;
    }
    if (APPLY) {
      const prov = herb.provenance || {};
      prov.image = {
        url: info.url,
        credit: `${info.artist} — ${info.licence}`,
        licence: info.licence,
        licence_url: info.licenceUrl || null,
        source: info.page,
        file,
        retrieved_at: new Date().toISOString().slice(0, 10),
      };
      const patch = await fetch(`${BASE}/rest/v1/herbs?id=eq.${herb.id}`, {
        method: "PATCH",
        headers: { ...H, Prefer: "return=minimal" },
        body: JSON.stringify({ image_url: info.url, provenance: prov }),
      });
      if (!patch.ok) {
        report.push({ slug: herb.slug, part, status: `patch ${patch.status}` });
        continue;
      }
      const check = await fetch(
        `${BASE}/rest/v1/herbs?select=image_url&id=eq.${herb.id}`,
        { headers: H }
      );
      const back = await check.json();
      if (back[0]?.image_url !== info.url) {
        report.push({ slug: herb.slug, part, status: "patch did not persist" });
        continue;
      }
    }
    report.push({
      slug: herb.slug,
      part,
      status: "replaced",
      file,
      licence: info.licence,
    });
  }

  const counts = {};
  for (const r of report) counts[r.status] = (counts[r.status] || 0) + 1;
  console.log("[parts] done:", JSON.stringify(counts));
  writeFileSync(
    `${ROOT}artifacts/image-part-fix.json`,
    JSON.stringify(report, null, 1)
  );
  for (const r of report.filter((x) => x.status === "replaced").slice(0, 6)) {
    console.log(`  ${r.slug} (${r.part}): ${r.file.slice(0, 60)}`);
  }
}

main().catch((e) => {
  console.error("[parts] fatal:", e.message);
  process.exit(1);
});
