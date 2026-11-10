#!/usr/bin/env node
/**
 * Second-pass herb photos: iNaturalist and GBIF.
 *
 * The Wikipedia pass left 322 published herbs with no photograph. This tries the
 * two remaining sources that publish machine-readable licences, and refuses
 * anything we could not legally republish on a commercial site.
 *
 * Two rules that matter more than the hit rate:
 *
 *  1. Licence allowlist only: CC0, public domain, CC BY, CC BY-SA. iNaturalist is
 *     filtered server-side by photo_license; GBIF results are filtered here.
 *     CC BY-NC is rejected — the site carries ads.
 *  2. The taxon must match the herb's binomial exactly. A photo of the right
 *     genus and the wrong species is worse than no photo: it is a factual error
 *     rendered in the most convincing possible form.
 *
 * Writes image_url plus provenance.image {credit, source, licence, licenceUrl},
 * and reads every row back — PostgREST returns 204 whether or not a row matched.
 *
 * Usage: node scripts/attach-herb-images-pass2.mjs [--apply] [--limit N]
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
const UA = "HerbAlly/1.0 (https://herbally.app; botanical reference site)";
const APPLY = process.argv.includes("--apply");
const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : 10000;

const ALLOWED =
  /^(cc0|public domain|cc by 2\.0|cc by 3\.0|cc by 4\.0|cc by-sa 2\.0|cc by-sa 3\.0|cc by-sa 4\.0|cc-by|cc-by-sa|cc0_1_0|cc_by_|cc_by_sa_)/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function apiJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
      });
      if (r.ok) return await r.json();
      if (r.status === 429 || r.status >= 500) await sleep(1500 * (i + 1));
      else return null;
    } catch {
      await sleep(1200 * (i + 1));
    }
  }
  return null;
}

/** First two words of a scientific name, lowercased. */
function binomial(name) {
  return String(name || "")
    .replace(/[×✕]/g, " ")
    .replace(/\b(var\.|subsp\.|f\.|cv\.)\b.*$/i, "")
    .replace(/\s+(L\.|Mill\.|Presl|Lam\.|Thunb\.|DC\.|Roxb\.).*$/i, "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .slice(0, 2)
    .join(" ");
}

/** Reject files that are not a usable photograph. */
async function checkImage(url) {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Range: "bytes=0-65535" },
    });
    if (!r.ok && r.status !== 206)
      return { ok: false, why: `http ${r.status}` };
    const type = r.headers.get("content-type") || "";
    if (!/^image\//.test(type))
      return { ok: false, why: `content-type ${type}` };
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 20000)
      return { ok: false, why: `too small (${buf.length}b)` };
    return { ok: true, type, bytes: buf.length };
  } catch (e) {
    return { ok: false, why: e.message };
  }
}

async function fromINaturalist(sci) {
  const target = binomial(sci);
  if (!target) return null;
  const taxa = await apiJson(
    `https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(sci)}&per_page=5`
  );
  for (const t of taxa?.results ?? []) {
    // Exact binomial only.
    if (String(t.name || "").toLowerCase() !== target) continue;
    const obs = await apiJson(
      `https://api.inaturalist.org/v1/observations?taxon_id=${t.id}` +
        `&photos=true&photo_license=cc0,cc-by,cc-by-sa&quality_grade=research&per_page=3&order_by=votes`
    );
    for (const o of obs?.results ?? []) {
      for (const p of o.photos ?? []) {
        if (p.license_code && !ALLOWED.test(p.license_code)) continue;
        const url = String(p.url || "").replace("/square.", "/original.");
        if (!url) continue;
        const ok = await checkImage(url);
        if (!ok.ok) continue;
        return {
          url,
          // cc0 -> CC0, cc-by -> CC BY, cc-by-sa -> CC BY-SA
          licence: !p.license_code
            ? "CC0"
            : p.license_code === "cc0"
              ? "CC0"
              : `CC ${p.license_code.replace(/^cc-/, "").toUpperCase()}`,
          licenceUrl: p.license_code
            ? `https://creativecommons.org/licenses/${p.license_code.replace("cc-", "")}/4.0/`
            : "https://creativecommons.org/publicdomain/zero/1.0/",
          credit: o.user?.name || o.user?.login || "iNaturalist contributor",
          source: `https://www.inaturalist.org/observations/${o.id}`,
          publisher: "iNaturalist",
        };
      }
    }
  }
  return null;
}

async function fromGbif(sci) {
  const target = binomial(sci);
  if (!target) return null;
  const match = await apiJson(
    `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(target)}`
  );
  if (!match?.usageKey) return null;
  if (String(match.canonicalName || "").toLowerCase() !== target) return null;
  const occ = await apiJson(
    `https://api.gbif.org/v1/occurrence/search?taxonKey=${match.usageKey}&mediaType=StillImage&limit=20`
  );
  for (const res of occ?.results ?? []) {
    const licenceRaw = res.license || res.media?.[0]?.license || "";
    if (!ALLOWED.test(licenceRaw)) continue;
    const med = (res.media ?? []).find(
      (m) => m.identifier && ALLOWED.test(m.license || licenceRaw)
    );
    if (!med) continue;
    const ok = await checkImage(med.identifier);
    if (!ok.ok) continue;
    return {
      url: med.identifier,
      licence: med.license || licenceRaw,
      licenceUrl: /creativecommons/i.test(med.license || licenceRaw)
        ? med.license || licenceRaw
        : null,
      credit: res.recordedBy || med.rightsHolder || "GBIF contributor",
      source: `https://www.gbif.org/occurrence/${res.key}`,
      publisher: "GBIF",
    };
  }
  return null;
}

async function main() {
  const herbs = [];
  for (let off = 0; ; off += 500) {
    const r = await fetch(
      `${BASE}/rest/v1/herbs?select=slug,name,scientific_name,provenance&is_published=eq.true&image_url=is.null&limit=500&offset=${off}`,
      { headers: H }
    );
    const page = await r.json();
    herbs.push(...page);
    if (page.length < 500) break;
  }
  console.log(`[img2] ${herbs.length} published herbs without a photo`);

  const report = [];
  let applied = 0;
  for (const herb of herbs.slice(0, LIMIT)) {
    const found =
      (await fromINaturalist(herb.scientific_name)) ||
      (await fromGbif(herb.scientific_name));
    if (!found) {
      report.push({ slug: herb.slug, status: "no licensed photo" });
      continue;
    }
    if (!APPLY) {
      report.push({ slug: herb.slug, status: "would attach", ...found });
      continue;
    }
    const provenance = {
      ...(herb.provenance ?? {}),
      image: {
        credit: found.credit,
        source: found.source,
        licence: found.licence,
        licenceUrl: found.licenceUrl,
        publisher: found.publisher,
      },
    };
    const res = await fetch(
      `${BASE}/rest/v1/herbs?slug=eq.${encodeURIComponent(herb.slug)}`,
      {
        method: "PATCH",
        headers: { ...H, Prefer: "return=minimal" },
        body: JSON.stringify({ image_url: found.url, provenance }),
      }
    );
    if (!res.ok) {
      report.push({ slug: herb.slug, status: `write ${res.status}` });
      continue;
    }
    // Read back: a 204 does not mean the row matched.
    const back = await fetch(
      `${BASE}/rest/v1/herbs?select=image_url&slug=eq.${encodeURIComponent(herb.slug)}`,
      { headers: H }
    );
    const [row] = await back.json();
    if (row?.image_url !== found.url) {
      report.push({ slug: herb.slug, status: "read-back mismatch" });
      continue;
    }
    applied++;
    report.push({ slug: herb.slug, status: "attached", ...found });
    if (applied % 10 === 0) console.log(`[img2] ${applied} attached`);
    await sleep(400);
  }

  const counts = {};
  for (const r of report) counts[r.status] = (counts[r.status] || 0) + 1;
  console.log("[img2] done:", JSON.stringify(counts));
  writeFileSync(
    `${ROOT}artifacts/herb-images-pass2.json`,
    JSON.stringify(report, null, 1)
  );
  for (const r of report.filter((x) => x.status === "attached").slice(0, 8)) {
    console.log(`  ${r.slug} · ${r.licence} · ${r.publisher}`);
  }
}

main().catch((e) => {
  console.error("[img2] fatal:", e.message);
  process.exit(1);
});
