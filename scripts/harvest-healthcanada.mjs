#!/usr/bin/env node
/**
 * Import Health Canada NHPID monographs.
 *
 * Health Canada publishes single-ingredient monographs for natural health products —
 * the regulator's own wording on uses, doses, cautions, contraindications and adverse
 * reactions, each claim carrying its reference. Government of Canada content sits under
 * the Open Government Licence – Canada, which grants a "worldwide, royalty-free,
 * perpetual, non-exclusive licence to use the Information, including for commercial
 * purposes", on condition that the source is acknowledged. That is why this source is
 * usable on an ad-supported site and several lookalikes are not (TGA forbids commercial
 * use outright; ANVISA's formulary is CC BY-NC-SA).
 *
 * One monograph = one herb_monographs row, generation_method "imported-ogl-canada",
 * text stored as published with the attribution kept in `provenance`. Nothing is
 * paraphrased: a regulator's wording is evidence, not copy to be improved.
 *
 * Usage:
 *   node scripts/harvest-healthcanada.mjs            # dry run, writes artifacts/hc-import.json
 *   node scripts/harvest-healthcanada.mjs --apply    # upsert into herb_monographs
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
  "HerbAlly/1.0 (https://herbally.app; importing Open Government Licence - Canada text with attribution)";
const APPLY = process.argv.includes("--apply");
const CACHE = `${ROOT}artifacts/hc-cache`;
const LIST_URL =
  "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/monosReq?monotype=single";
const PAGE = (id) =>
  `https://webprod.hc-sc.gc.ca/nhpid-bdipsn/atReq?atid=${encodeURIComponent(id)}&lang=eng`;
const ATTRIBUTION =
  "Contains information licensed under the Open Government Licence – Canada.";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ENTITIES = {
  semi: ";",
  apos: "'",
  ndash: "\u2013",
  mdash: "\u2014",
  amp: "&",
  rpar: ")",
  lpar: "(",
  rsquo: "\u2019",
  lsquo: "\u2018",
  ldquo: "\u201C",
  rdquo: "\u201D",
  nbsp: " ",
  eacute: "\u00E9",
  Eacute: "\u00C9",
  egrave: "\u00E8",
  agrave: "\u00E0",
  aacute: "\u00E1",
  auml: "\u00E4",
  ouml: "\u00F6",
  uuml: "\u00FC",
  oacute: "\u00F3",
  iacute: "\u00ED",
  oslash: "\u00F8",
  ccedil: "\u00E7",
  ocirc: "\u00F4",
  alpha: "\u03B1",
  omega: "\u03C9",
  reg: "\u00AE",
  gt: ">",
  lt: "<",
  ge: "\u2265",
  le: "\u2264",
  quot: '"',
};

const decode = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCodePoint(parseInt(h, 16))
    )
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-zA-Z][a-zA-Z0-9]{1,10});/g, (m, name) =>
      Object.prototype.hasOwnProperty.call(ENTITIES, name) ? ENTITIES[name] : m
    );

/** HTML -> array of non-empty text lines, tables flattened. */
function toLines(html) {
  const main = html.match(/<main[\s\S]*?<\/main>/i);
  let body = main ? main[0] : html;
  body = body
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    // The page carries a <select> of every monograph's statements (the
    // "monograph combination guide"); flattened to text it injects other herbs'
    // cautions into this one. Remove the interactive chrome before reading.
    .replace(/<select[\s\S]*?<\/select>/gi, " ")
    .replace(/<option[\s\S]*?<\/option>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<form[\s\S]*?<\/form>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ");
  return decode(body.replace(/<[^>]+>/g, "\n"))
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/**
 * Any of these ends a section. The first version only stopped at the *next* known
 * heading, so "Known adverse reaction(s)" ran on into product-labelling boilerplate
 * (storage conditions, non-medicinal ingredients) and a page ended up with 72
 * "adverse reactions" of which 2 were real.
 */
const STOP = [
  /^Use\(s\) or Purpose\(s\)$/i,
  /^Dose\(s\)$/i,
  /^Direction\(s\) for use/i,
  /^Duration\(s\) of Use/i,
  /^Risk Information$/i,
  /^Caution\(s\) and warning\(s\)$/i,
  /^Contraindication\(s\)$/i,
  /^Known adverse reaction\(s\)$/i,
  /^References?$/i,
  /^Route of Administration$/i,
  /^Dosage Form\(s\)$/i,
  /^Monograph combination guide$/i,
  /^Non-medicinal ingredients$/i,
  /^Storage conditions?$/i,
  /^Specifications?$/i,
  /^Example product/i,
  /^Date$/i,
  /^Subpopulation\(s\)$/i,
  /^Quantity\(ies\)$/i,
  /^Notes?$/i,
];

/** Slice of lines between a heading and the next heading of any kind. */
function section(lines, startRe, endRes, ignoreStop = []) {
  const start = lines.findIndex((l) => startRe.test(l));
  if (start < 0) return [];
  let end = lines.length;
  const stops = [
    ...endRes,
    ...STOP.filter((re) => !ignoreStop.some((x) => String(x) === String(re))),
  ];
  for (const re of stops) {
    const i = lines.findIndex((l, n) => n > start && re.test(l));
    if (i >= 0 && i < end) end = i;
  }
  return lines.slice(start + 1, end);
}

/** Drop page furniture that is not part of the monograph body. */
function clean(items) {
  return items
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(
      (l) =>
        l &&
        !/^\(PDF Version/i.test(l) &&
        !/^This monograph is intended to serve as a guide/i.test(l) &&
        !/^Table \d+/i.test(l) &&
        !/^Notes?$/i.test(l) &&
        !/^(Must |Non-medicinal|Storage conditions?|Specifications?|Example product|Products making|All products$|All uses$|For multi-ingredient|To prevent the product|When ALL of|Subpopulation\(s\)$|Quantity\(ies\)$|Methods of preparation)/i.test(
          l
        )
    );
}

/** The two name columns sit above "Route of Administration". */
function names(lines) {
  const stop = lines.findIndex((l) => /^Route of Administration$/i.test(l));
  const head = lines.slice(0, stop < 0 ? 40 : stop);
  const proper = [];
  for (const l of head) {
    const m = l.match(/^([A-Z][a-z]{2,}) ([a-z-]{3,})( L\.)?$/);
    if (m) proper.push(l);
  }
  return [...new Set(proper)];
}

/** "May 29, 2026" or "2026-05-29" -> ISO date, or null. */
function toDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

async function fetchCached(id) {
  const file = `${CACHE}/${id}.html`;
  if (existsSync(file)) return readFileSync(file, "utf8");
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(PAGE(id), { headers: { "User-Agent": UA } });
      const body = await r.text();
      if (r.ok && body.length > 2000 && !/^\{"timestamp"/.test(body)) {
        mkdirSync(CACHE, { recursive: true });
        writeFileSync(file, body);
        await sleep(700);
        return body;
      }
    } catch {
      /* retry below */
    }
    await sleep(1500 * (attempt + 1));
  }
  return null;
}

function slugify(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  const listing = await fetch(LIST_URL, { headers: { "User-Agent": UA } }).then(
    (r) => r.text()
  );
  const pairs = [
    ...listing.matchAll(
      /href="(?:\.\/)?atReq[^"]*?atid=([^&"]+)[^"]*"[^>]*>([^<]{2,90})</g
    ),
  ].map(([, id, name]) => ({ id: decode(id), name: decode(name).trim() }));
  const seen = new Set();
  const entries = pairs.filter((p) =>
    seen.has(p.id) ? false : seen.add(p.id)
  );
  console.log(`[hc] ${entries.length} single-ingredient monographs listed`);

  // Herb lookup: scientific name, common name, and slug all resolve to one row.
  const herbs = [];
  for (let from = 0; ; from += 1000) {
    const batch = await fetch(
      `${BASE}/rest/v1/herbs?select=id,slug,name,scientific_name&is_published=eq.true&limit=1000&offset=${from}`,
      { headers: H }
    ).then((r) => r.json());
    herbs.push(...batch);
    if (batch.length < 1000) break;
  }
  // "Alfalfa - Leaf (Oral)" and "alfalfa-leaf" must land on the same key.
  const normalise = (v) =>
    (v ?? "")
      .toLowerCase()
      .replace(/\([^)]*\)/g, " ")
      .replace(
        /\b(extract|extracts|powder|powdered|dry|dried|oral|topical|root|leaf|leaves|herb|seed|seeds|fruit|flower|flowers|bark|gel|tincture)\b/g,
        " "
      )
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const byNormalised = new Map();
  const byScientific = new Map();
  const byName = new Map();
  for (const h of herbs) {
    if (h.scientific_name)
      byScientific.set(h.scientific_name.toLowerCase().trim(), h);
    if (h.name) byName.set(h.name.toLowerCase().trim(), h);
    byName.set(h.slug.replace(/-/g, " "), h);
    for (const key of new Set([
      normalise(h.name ?? ""),
      normalise(h.slug.replace(/-/g, " ")),
    ])) {
      if (!key) continue;
      const list = byNormalised.get(key) ?? [];
      list.push(h);
      byNormalised.set(key, list);
    }
  }

  const report = [];
  const rows = [];
  // One herb, one monograph. Two sources disagreeing is a collision to report, not
  // a last-write-wins race.
  const usedSlugs = new Set();
  for (const entry of entries) {
    const html = await fetchCached(entry.id);
    if (!html) {
      report.push({ name: entry.name, status: "fetch failed" });
      continue;
    }
    const lines = toLines(html);

    const uses = clean(
      section(lines, /^Use\(s\) or Purpose\(s\)$/i, [/^Dose\(s\)$/i, /^Note/i])
    );
    const doses = clean(
      section(
        lines,
        /^Dose\(s\)$/i,
        [
          /^Direction\(s\) for use/i,
          /^Duration\(s\) of Use/i,
          /^Risk Information$/i,
        ],
        [/^Subpopulation\(s\)$/i, /^Quantity\(ies\)$/i, /^Notes?$/i]
      )
    );
    const risk = clean(
      section(lines, /^Risk Information$/i, [/^References?$/i])
    );
    const cautions = clean(
      section(lines, /^Caution\(s\) and warning\(s\)$/i, [
        /^Contraindication\(s\)$/i,
      ])
    );
    const contraindications = clean(
      section(lines, /^Contraindication\(s\)$/i, [
        /^Known adverse reaction\(s\)$/i,
        /^References?$/i,
      ])
    );
    const adverse = clean(
      section(lines, /^Known adverse reaction\(s\)$/i, [/^References?$/i])
    );
    const proper = names(lines);

    // Matching, in order of how much the evidence can be trusted:
    //   1. the binomial printed in the listing name ("Dong quai - Angelica sinensis")
    //   2. the binomial in the page's own title line
    //   3. the common name in the listing
    // Free prose is never a source of identity. The first version scanned the whole
    // header for anything binomial-shaped, so the DIM page — whose combination rules
    // mention "dong quai - Angelica sinensis" in a sentence — was imported as dong
    // quai. Five monographs ended up pointing at one herb that way.
    const title = lines.slice(0, 3).join(" ");
    const listingBase = entry.name.split(/\s+[-–]\s+/)[0].trim();
    const listingBinomial =
      (entry.name.match(/[-–]\s*([A-Z][a-z]+ [a-z-]{3,})/) ?? [])[1] ?? null;
    const titleBinomial =
      (title.match(/([A-Z][a-z]+ [a-z-]{3,})/) ?? [])[1] ?? null;

    let herb = null;
    let matchedBy = "none";
    if (listingBinomial && byScientific.has(listingBinomial.toLowerCase())) {
      herb = byScientific.get(listingBinomial.toLowerCase());
      matchedBy = "listing binomial";
    } else if (titleBinomial && byScientific.has(titleBinomial.toLowerCase())) {
      herb = byScientific.get(titleBinomial.toLowerCase());
      matchedBy = "title binomial";
    } else {
      const norm = normalise(listingBase);
      const exact = byNormalised.get(norm);
      if (exact && exact.length === 1) {
        herb = exact[0];
        matchedBy = "common name";
      } else if (exact && exact.length > 1) {
        report.push({
          name: entry.name,
          status: `ambiguous — ${exact.length} herbs match "${norm}"`,
        });
        continue;
      } else {
        // Containment, but only when exactly one herb can be meant.
        const candidates = herbs.filter((h) => {
          const hn = normalise(h.name ?? "");
          const hs = normalise(h.slug.replace(/-/g, " "));
          return (
            norm.length >= 4 &&
            (hn === norm ||
              hs === norm ||
              hn.includes(norm) ||
              hs.includes(norm))
          );
        });
        if (candidates.length === 1) {
          herb = candidates[0];
          matchedBy = "common name (containment)";
        } else if (candidates.length > 1) {
          report.push({
            name: entry.name,
            status: `ambiguous — ${candidates.length} herbs match "${norm}"`,
          });
          continue;
        }
      }
    }
    if (!herb) {
      report.push({ name: entry.name, status: "no matching herb" });
      continue;
    }
    if (usedSlugs.has(herb.slug)) {
      report.push({
        name: entry.name,
        slug: herb.slug,
        status: "collision — herb already claimed",
      });
      continue;
    }

    if (uses.length === 0) {
      report.push({
        name: entry.name,
        slug: herb.slug,
        status: "no uses parsed",
      });
      continue;
    }

    const safety = [
      ...new Set([...cautions, ...contraindications, ...adverse]),
    ];
    const row = {
      herb_slug: herb.slug,
      // One row per source: Health Canada and NCCIH can both describe the same
      // plant. Writing to herb_monographs made the newer import overwrite the older.
      source: "Health Canada",
      licence: "ogl-canada",
      attribution: ATTRIBUTION,
      url: PAGE(entry.id),
      claims: uses.map((text) => ({ section: "Use(s) or Purpose(s)", text })),
      safety,
      doses,
      generation_method: "imported-ogl-canada",
      monograph_date: toDate(
        lines.find((l) =>
          /^\d{4}-\d{2}-\d{2}$|^[A-Z][a-z]+ \d{1,2}, \d{4}$/.test(l)
        )
      ),
      retrieved_at: new Date().toISOString().slice(0, 10),
    };
    usedSlugs.add(herb.slug);
    rows.push(row);
    report.push({
      name: entry.name,
      slug: herb.slug,
      status: APPLY ? "pending" : "would import",
      matched_by: matchedBy,
      uses: uses.length,
      safety: safety.length,
      doses: doses.length,
    });
  }

  mkdirSync(`${ROOT}artifacts`, { recursive: true });
  writeFileSync(
    `${ROOT}artifacts/hc-import.json`,
    JSON.stringify({ report, rows }, null, 2)
  );
  console.log(
    `[hc] matched ${rows.length} of ${entries.length}; ` +
      `no-match ${report.filter((r) => r.status === "no matching herb").length}, ` +
      `failed ${report.filter((r) => r.status === "fetch failed").length}`
  );

  if (APPLY) {
    let ok = 0;
    const failures = [];
    for (const row of rows) {
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
      if (res.ok) ok++;
      else
        failures.push({
          slug: row.herb_slug,
          status: res.status,
          body: (await res.text()).slice(0, 200),
        });
    }
    console.log(`[hc] upserted ${ok}/${rows.length}`);
    if (failures.length) {
      writeFileSync(
        `${ROOT}artifacts/hc-import-failures.json`,
        JSON.stringify(failures, null, 2)
      );
      console.log(`[hc] failures written to artifacts/hc-import-failures.json`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
