#!/usr/bin/env node
/**
 * Import NCCIH herb pages as sourced monographs.
 *
 * NCCIH is part of the US National Institutes of Health, so its text is a work of
 * the US government and not subject to copyright (17 U.S.C. §105). That makes it
 * the one genuinely free source of consumer-grade herb monographs we can reproduce
 * with attribution — the paid alternative (AHP) is $1,478 for 45 monographs.
 *
 * The 56 herbs it covers are the ones people actually search, which is why this is
 * worth more than its size suggests.
 *
 * Each page becomes one herb_monographs row with generation_method
 * 'nccih-public-domain' and a provenance block naming the URL and licence. No text
 * is rewritten: the bullets are stored as they appear.
 *
 * Usage: node scripts/harvest-nccih.mjs [--apply]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

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
const UA =
  "HerbAlly/1.0 (https://herbally.app; importing public-domain NIH text with attribution)";
const APPLY = process.argv.includes("--apply");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const INDEX = "https://www.nccih.nih.gov/health/herbsataglance";

/**
 * URL slugs that are not our slugs, mapped deliberately. Anything not found by
 * slug, name or binomial is skipped rather than guessed — a wrong herb is worse
 * than a missing one.
 */
const OVERRIDES = {
  ginkgo: "ginkgo-biloba",
  "white-mulberry-leaf": "mulberry-leaf",
};
/**
 * Pages with no honest home here:
 *  - soy: no soy entry; "glycine-max" is a branded soy derivative, and importing
 *    soy text there would describe a different product.
 *  - pomegranate: our only page is pomegranate PEEL, the NCCIH page is about the
 *    fruit juice. Parts are never merged.
 *  - herblist-app: not an herb.
 */
const SKIP = new Set(["soy", "pomegranate", "herblist-app"]);

/** Markdown page -> {title, latin, sections}. */
function parsePage(md) {
  const out = { title: "", latin: [], sections: {} };
  const lines = md.split("\n");
  // The markdown arrives with a "Title:" header, not an H1.
  const header = md.match(/^Title:\s*(.+)$/m);
  // "Aloe Vera: Usefulness and Safety" -> "Aloe Vera"
  const rawTitle = header
    ? header[1].trim()
    : (lines.find((l) => l.startsWith("# ")) || "").replace(/^#\s*/, "").trim();
  out.title = rawTitle.split(/[:|]/)[0].trim();
  const latin = md.match(/\*\*Latin Names?:\*\*\s*([^\n]+)/i);
  if (latin) {
    out.latin = latin[1]
      .replace(/[_*]/g, "")
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  let current = null;
  for (const line of lines) {
    const h = line.match(/^##\s+(.+)$/);
    if (h) {
      current = h[1].trim().toLowerCase();
      out.sections[current] = [];
      continue;
    }
    if (!current) continue;
    if (/^#+\s/.test(line)) continue;
    out.sections[current].push(line);
  }
  const clean = (arr) =>
    (arr || [])
      .join("\n")
      .split("\n")
      .map((l) => l.replace(/^[-*]\s*/, "").trim())
      .filter((l) => l && !/^\[?(Photo|Image)/i.test(l))
      .filter((l) => !/^for more information/i.test(l));
  return { title: out.title, latin: out.latin, sections: out.sections, clean };
}

async function main() {
  // The index is HTML; the article parser needs markdown, so the page list is
  // captured once into artifacts/nccih-pages.json rather than scraped here.
  const unique = JSON.parse(
    readFileSync(`${ROOT}artifacts/nccih-pages.json`, "utf8")
  );
  console.log(`[nccih] ${unique.length} herb pages`);

  const herbs = [];
  for (let off = 0; ; off += 1000) {
    const r = await fetch(
      `${BASE}/rest/v1/herbs?select=id,slug,name,scientific_name&limit=1000&offset=${off}`,
      { headers: H }
    );
    const page = await r.json();
    herbs.push(...page);
    if (page.length < 1000) break;
  }
  // Several slugs can share a binomial (Korean red ginseng extract vs ginseng).
  // Picking whichever came first put the NCCIH monograph on a niche duplicate, so
  // candidates are ranked and the page with the most content wins.
  const score = (h) =>
    (h.traditional_uses?.length ? 2 : 0) +
    (String(h.dosage_adult || "").trim() ? 2 : 0) +
    (h.image_url ? 1 : 0) -
    h.slug.length / 200;
  const byLatin = new Map();
  const byName = new Map();
  const bySlug = new Map(herbs.map((h) => [h.slug, h]));
  for (const h of herbs) {
    const b = String(h.scientific_name || "")
      .toLowerCase()
      .split(/\s+/)
      .slice(0, 2)
      .join(" ");
    if (b && (!byLatin.has(b) || score(h) > score(byLatin.get(b))))
      byLatin.set(b, h);
    const key = h.name ? String(h.name).toLowerCase() : "";
    if (key && (!byName.has(key) || score(h) > score(byName.get(key))))
      byName.set(key, h);
  }

  const report = [];
  for (const url of unique) {
    let md;
    // jina.ai rate-limits the free endpoint, so each page is cached on disk and
    // retried with backoff. A re-run costs nothing for pages already fetched.
    const cache = `${ROOT}artifacts/nccih-cache/${url.split("/").pop()}.md`;
    if (existsSync(cache)) {
      md = readFileSync(cache, "utf8");
    } else {
      for (let attempt = 0; attempt < 4 && !md; attempt++) {
        try {
          const r = await fetch(`https://r.jina.ai/${url}`, {
            headers: { "User-Agent": UA },
          });
          const body = await r.text();
          if (r.ok && body.length > 2000) {
            md = body;
            mkdirSync(`${ROOT}artifacts/nccih-cache`, { recursive: true });
            writeFileSync(cache, body);
          } else {
            await sleep(3000 * (attempt + 1));
          }
        } catch (e) {
          await sleep(3000 * (attempt + 1));
        }
      }
    }
    await sleep(1500);
    if (!md || md.length < 800) {
      report.push({ url, status: "empty body" });
      continue;
    }
    const p = parsePage(md);
    // The NCCIH URL slug is usually our slug too (ginkgo, soy, green-tea). Try it
    // first, then the common name, then the binomial — a binomial match can land
    // on a part-specific duplicate (Aloe vera -> aloe-vera-leaf, Citrus aurantium
    // -> neroli-oil) or a TCM-named page (Ginkgo -> bai-guo).
    const slugTail = url.split("/").pop();
    if (SKIP.has(slugTail)) {
      report.push({ url, title: p.title, status: "skipped (no honest match)" });
      continue;
    }
    const target = OVERRIDES[slugTail] ?? slugTail;
    let herb = bySlug.get(target) || byName.get(p.title.toLowerCase()) || null;
    if (!herb) {
      for (const l of p.latin) {
        const b = l
          .toLowerCase()
          .replace(/\s+/g, " ")
          .split(" ")
          .slice(0, 2)
          .join(" ");
        if (byLatin.has(b)) {
          herb = byLatin.get(b);
          break;
        }
      }
    }
    if (!herb) {
      report.push({
        url,
        title: p.title,
        latin: p.latin,
        status: "no matching herb",
      });
      continue;
    }

    const background = p.clean(p.sections["background"]);
    const learned = p.clean(p.sections["what have we learned?"]);
    const safety = p.clean(p.sections["what do we know about safety?"]);
    const know = p.clean(p.sections["how much do we know?"]);
    if (!background.length && !learned.length && !safety.length) {
      report.push({ url, title: p.title, status: "no usable sections" });
      continue;
    }

    const row = {
      herb_slug: herb.slug,
      // Imported sources live in their own table, one row per source, so a second
      // regulator can describe the same herb without overwriting this one.
      source: "NCCIH",
      licence: "us-federal-public-domain",
      attribution:
        "US government work, not subject to copyright (17 U.S.C. §105).",
      url,
      claims: background,
      safety,
      doses: [],
      generation_method: "imported-public-domain",
      monograph_date: null,
      retrieved_at: new Date().toISOString().slice(0, 10),
    };

    if (APPLY) {
      const res = await fetch(
        `${BASE}/rest/v1/herb_monograph_sources?on_conflict=herb_slug,source`,
        {
          method: "POST",
          headers: {
            ...H,
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify([row]),
        }
      );
      if (!res.ok) {
        report.push({ url, title: p.title, status: `upsert ${res.status}` });
        continue;
      }
    }
    report.push({
      url,
      title: p.title,
      slug: herb.slug,
      status: "imported",
      bullets: background.length + learned.length + safety.length,
    });
  }

  const counts = {};
  for (const r of report) counts[r.status] = (counts[r.status] || 0) + 1;
  console.log("[nccih] done:", JSON.stringify(counts));
  writeFileSync(
    `${ROOT}artifacts/nccih-import.json`,
    JSON.stringify(report, null, 1)
  );
  for (const r of report.filter((x) => x.status === "imported").slice(0, 8)) {
    console.log(`  ${r.slug} <- ${r.title} (${r.bullets} bullets)`);
  }
}

main().catch((e) => {
  console.error("[nccih] fatal:", e.message);
  process.exit(1);
});
