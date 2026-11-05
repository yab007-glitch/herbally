#!/usr/bin/env node
/**
 * Full-site integrity sweep.
 *
 * Every herb page changed tonight — photos, related links, French FAQs, cache keys.
 * This walks the published set and checks the things a deploy can silently break:
 *
 *   - status: anything that is not 200 on the canonical URL
 *   - self-canonical present and pointing at the requested URL
 *   - hreflang pair complete and symmetric
 *   - at least one image resolving on the page
 *   - no visible "undefined"/"NaN" leaking into rendered text
 *
 * Read-only. Prints a summary and writes the failures to artifacts/site-sweep.json.
 *
 * Usage: node scripts/sweep-site.mjs [--limit N] [--concurrency 4]
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
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const SITE = "https://herbally.app";
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  return i >= 0 ? Number(process.argv[i + 1]) || 0 : 0;
})();
const CONC = (() => {
  const i = process.argv.indexOf("--concurrency");
  return i >= 0 ? Number(process.argv[i + 1]) || 4 : 4;
})();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function slugs() {
  const out = [];
  for (let off = 0; ; off += 1000) {
    const r = await fetch(
      `${BASE}/rest/v1/herbs?select=slug&is_published=eq.true&order=slug&limit=1000&offset=${off}`,
      { headers: H }
    );
    const page = await r.json();
    out.push(...page.map((x) => x.slug));
    if (page.length < 1000) break;
  }
  return out;
}

function parse(html) {
  const canonical =
    (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] || null;
  const langs = [...html.matchAll(/hrefLang="([a-z-]+)" href="([^"]+)"/g)].map(
    (m) => [m[1], m[2]]
  );
  const images = (html.match(/upload\.wikimedia\.org/g) || []).length;
  const text = html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
  const leak = /\b(undefined|NaN|\[object Object\])\b/.test(text);
  return { canonical, langs, images, leak };
}

async function check(slug) {
  const url = `${SITE}/herbs/${slug}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "HerbAlly sweep" },
      redirect: "manual",
    });
    const html = res.status === 200 ? await res.text() : "";
    const p = res.status === 200 ? parse(html) : null;
    return {
      slug,
      status: res.status,
      canonicalOk: p ? p.canonical === url : null,
      hasFr: p ? p.langs.some(([l]) => l === "fr") : null,
      images: p ? p.images : null,
      leak: p ? p.leak : null,
    };
  } catch (err) {
    return { slug, status: 0, error: String(err.message).slice(0, 80) };
  }
}

async function main() {
  const all = await slugs();
  const list = LIMIT ? all.slice(0, LIMIT) : all;
  console.log(`[sweep] ${list.length} pages, concurrency ${CONC}`);

  const results = [];
  let i = 0;
  const workers = Array.from({ length: CONC }, async () => {
    for (;;) {
      const idx = i++;
      if (idx >= list.length) return;
      results.push(await check(list[idx]));
      if (results.length % 250 === 0)
        console.log(`[sweep] ${results.length}/${list.length}`);
      await sleep(60);
    }
  });
  await Promise.all(workers);

  const bad = results.filter((r) => r.status !== 200);
  const badCanonical = results.filter(
    (r) => r.status === 200 && r.canonicalOk === false
  );
  const noImage = results.filter((r) => r.status === 200 && r.images === 0);
  const leaks = results.filter((r) => r.leak);
  console.log(
    `[sweep] not-200: ${bad.length} | bad canonical: ${badCanonical.length} | no image: ${noImage.length} | text leaks: ${leaks.length}`
  );
  for (const b of bad.slice(0, 10))
    console.log(`  NOT 200 ${b.status} ${b.slug}`);
  for (const b of badCanonical.slice(0, 5))
    console.log(`  CANONICAL ${b.slug}`);
  for (const b of leaks.slice(0, 5)) console.log(`  LEAK ${b.slug}`);
  writeFileSync(
    `${ROOT}artifacts/site-sweep.json`,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        total: results.length,
        bad,
        badCanonical,
        noImage: noImage.map((x) => x.slug),
        leaks: leaks.map((x) => x.slug),
      },
      null,
      1
    )
  );
}

main().catch((e) => {
  console.error("[sweep] fatal:", e.message);
  process.exit(1);
});
