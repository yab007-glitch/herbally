#!/usr/bin/env node
/**
 * Attach a licensed botanical photograph to each herb, from Wikimedia Commons.
 *
 * Rules, all enforced here rather than trusted to the uploader:
 *   - the image must come from Commons (not Wikipedia-local fair-use files)
 *   - the licence must be one we can use on a commercial site: CC0, public domain,
 *     CC BY, or CC BY-SA. Anything marked non-free, "fair use", or with no licence
 *     metadata is skipped.
 *   - the author/licence/Commons page are recorded and rendered as a credit.
 *
 * The herb's scientific name is the lookup key: Latin binomials resolve far more
 * reliably than common names, which collide ("hemlock" is two different plants).
 *
 * Usage: node scripts/attach-herb-images.mjs [--apply] [--limit N] [--slugs a,b,c]
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
const UA =
  "HerbAlly/1.0 (https://herbally.app; botanical images with attribution)";
const APPLY = process.argv.includes("--apply");
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  return i >= 0 ? Number(process.argv[i + 1]) || 0 : 0;
})();
const SLUGS = (() => {
  const i = process.argv.indexOf("--slugs");
  return i >= 0
    ? new Set(
        String(process.argv[i + 1] || "")
          .split(",")
          .filter(Boolean)
      )
    : null;
})();

const ALLOWED =
  /^(cc0|cc[- ]by(-sa)?[- ]?\d|public domain|pd-|no restrictions)/i;
// Wikimedia tolerates ~200 req/min and this script makes three per herb; 900ms
// between calls keeps it near a third of that, because the first run at 350ms got
// "upstream request timeout" pages back from the API.
const SLEEP = 900;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(host, params, tries = 4) {
  const qs = new URLSearchParams({
    format: "json",
    origin: "*",
    ...params,
  }).toString();
  // MediaWiki sometimes answers with a plain-text upstream error instead of JSON
  // ("upstream request timeout"), which used to abort the entire backfill. That is
  // retryable, not fatal.
  for (let attempt = 1; ; attempt++) {
    let body = "";
    try {
      const r = await fetch(`https://${host}/w/api.php?${qs}`, {
        headers: { "User-Agent": UA },
      });
      if (r.status === 429 || r.status >= 500) {
        if (attempt < tries) {
          await sleep(1500 * attempt);
          continue;
        }
        throw new Error(`${host} ${r.status}`);
      }
      body = await r.text();
      if (!r.ok) throw new Error(`${host} ${r.status}`);
      return JSON.parse(body);
    } catch (err) {
      const retryable =
        /JSON|Unexpected token/i.test(String(err.message)) ||
        /^upstream/i.test(body.trim());
      if (retryable && attempt < tries) {
        await sleep(1500 * attempt);
        continue;
      }
      throw err;
    }
  }
}

/** Lead image for a Wikipedia article, if one exists. */
async function leadImage(title) {
  const j = await api("en.wikipedia.org", {
    action: "query",
    prop: "pageimages",
    piprop: "original|name",
    titles: title,
    redirects: "1",
  });
  const pages = j.query?.pages ?? {};
  const page = Object.values(pages)[0];
  if (!page || page.missing !== undefined) return null;
  // `pageimage` is absent on many responses even when `original` is present, which
  // made the first backfill skip plants that do have a lead photo. Fall back to the
  // filename inside the original URL.
  const originalUrl = (page.original?.source ?? "").split("?")[0];
  const file =
    page.pageimage ||
    (originalUrl
      ? decodeURIComponent(originalUrl.split("/").pop() || "")
      : null);
  if (!file) return null;
  return { file, url: originalUrl || null };
}

/**
 * Fallback for plants with no English Wikipedia article: search Commons itself.
 *
 * The search is restricted to the File namespace and the file name must contain the
 * genus and the epithet, so a paper titled "Abrus precatorius seeds" cannot be
 * mistaken for Abrus cantoniensis.
 */
async function commonsSearch(sci) {
  const parts = String(sci).toLowerCase().split(/\s+/).slice(0, 2);
  const j = await api("commons.wikimedia.org", {
    action: "query",
    list: "search",
    srsearch: `filetype:bitmap ${sci}`,
    srnamespace: "6",
    srlimit: "5",
  });
  const hits = j.query?.search ?? [];
  for (const hit of hits) {
    const title = String(hit.title || "").replace(/^File:/, "");
    const lower = title.toLowerCase();
    if (parts.every((p) => p && lower.includes(p))) {
      return { file: title, url: null };
    }
  }
  return null;
}

/** Licence + author for a Commons file. */
async function licenceInfo(fileName) {
  const j = await api("commons.wikimedia.org", {
    action: "query",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    titles: `File:${fileName}`,
  });
  const pages = j.query?.pages ?? {};
  const page = Object.values(pages)[0];
  if (!page || page.missing !== undefined) return null;
  const info = page.imageinfo?.[0];
  if (!info) return null;
  const meta = info.extmetadata ?? {};
  const strip = (v) =>
    (v?.value ?? "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  return {
    url: info.url,
    descriptionUrl: info.descriptionurl,
    licence: strip(meta.LicenseShortName),
    licenceUrl: strip(meta.LicenseUrl),
    artist: strip(meta.Artist) || "Unknown",
    credit: strip(meta.Credit),
    restrictions: strip(meta.Restrictions),
  };
}

async function main() {
  const herbs = [];
  for (let off = 0; ; off += 1000) {
    const r = await fetch(
      `${BASE}/rest/v1/herbs?select=id,slug,name,scientific_name,image_url,provenance&is_published=eq.true&order=slug&limit=1000&offset=${off}`,
      { headers: H }
    );
    const page = await r.json();
    herbs.push(...page);
    if (page.length < 1000) break;
  }
  let work = herbs.filter((h) => !h.image_url && h.scientific_name);
  if (SLUGS) work = herbs.filter((h) => SLUGS.has(h.slug));
  if (LIMIT) work = work.slice(0, LIMIT);
  console.log(`[img] ${work.length} herbs to try${APPLY ? "" : " (dry run)"}`);

  const report = [];
  let processed = 0;
  for (const herb of work) {
    processed++;
    if (processed % 50 === 0) {
      console.log(
        `[img] ${processed}/${work.length} | ${report.filter((r) => r.status === "image").length} images`
      );
      await sleep(5000);
    }
    const sci = String(herb.scientific_name)
      .replace(/\s*\(.*?\)\s*/g, " ")
      .trim();
    let lead = null;
    try {
      lead = await leadImage(sci);
      if (!lead) lead = await leadImage(herb.name);
      if (!lead) {
        await sleep(SLEEP);
        lead = await commonsSearch(sci);
      }
    } catch (e) {
      report.push({ slug: herb.slug, status: `lookup failed: ${e.message}` });
      await sleep(SLEEP);
      continue;
    }
    await sleep(SLEEP);
    if (!lead) {
      report.push({ slug: herb.slug, status: "no image" });
      continue;
    }
    let info = null;
    try {
      info = await licenceInfo(lead.file);
    } catch (e) {
      report.push({
        slug: herb.slug,
        status: `licence lookup failed: ${e.message}`,
      });
      await sleep(SLEEP);
      continue;
    }
    await sleep(SLEEP);
    if (!info) {
      report.push({ slug: herb.slug, status: "no licence metadata" });
      continue;
    }
    if (info.restrictions && /non-free|fair use/i.test(info.restrictions)) {
      report.push({
        slug: herb.slug,
        status: `restricted: ${info.restrictions}`,
      });
      continue;
    }
    if (!ALLOWED.test(info.licence)) {
      report.push({
        slug: herb.slug,
        status: `licence not allowed: ${info.licence || "none"}`,
      });
      continue;
    }
    const record = {
      url: info.url,
      credit: `${info.artist} — ${info.licence}`,
      licence: info.licence,
      licence_url: info.licenceUrl || null,
      source: info.descriptionUrl,
      file: lead.file,
      retrieved_at: new Date().toISOString().slice(0, 10),
    };
    if (APPLY) {
      const prov = herb.provenance || {};
      prov.image = record;
      const patch = await fetch(`${BASE}/rest/v1/herbs?id=eq.${herb.id}`, {
        method: "PATCH",
        headers: { ...H, Prefer: "return=minimal" },
        body: JSON.stringify({ image_url: info.url, provenance: prov }),
      });
      if (!patch.ok) {
        report.push({ slug: herb.slug, status: `patch ${patch.status}` });
        continue;
      }
      // PostgREST answers 204 even when the filter matched no rows, so the write is
      // only real if a read-back shows it. This is how the first run "applied" nine
      // images and left every image_url null.
      const check = await fetch(
        `${BASE}/rest/v1/herbs?select=image_url&id=eq.${herb.id}`,
        { headers: H }
      );
      const rows = await check.json();
      if (!rows[0]?.image_url) {
        report.push({ slug: herb.slug, status: "patch did not persist" });
        continue;
      }
    }
    report.push({ slug: herb.slug, status: "image", ...record });
  }

  const counts = {};
  for (const r of report)
    counts[r.status.split(":")[0]] = (counts[r.status.split(":")[0]] || 0) + 1;
  console.log("[img] done:", JSON.stringify(counts));
  writeFileSync(
    `${ROOT}artifacts/herb-images.json`,
    JSON.stringify(
      { generated_at: new Date().toISOString(), applied: APPLY, report },
      null,
      1
    )
  );
  for (const r of report.filter((x) => x.status === "image").slice(0, 5)) {
    console.log(`  ${r.slug}: ${r.licence} — ${r.credit.slice(0, 60)}`);
  }
}

main().catch((e) => {
  console.error("[img] fatal:", e.message);
  process.exit(1);
});
