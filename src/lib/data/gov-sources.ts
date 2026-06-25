/**
 * Government & authoritative-source registry for herb content.
 *
 * Dawn Wong (reviewer) flagged that the herb data is not accurate and that we
 * should ground it in government sources. This registry is the canonical
 * mapping of herb slugs to real, verifiable government monograph pages so the
 * site can surface the credible source of truth on every herb page and the
 * review/correction workflow can fetch the authoritative text.
 *
 * Sources prioritised (all government / intergovernmental):
 *   - NCCIH (NIH) "Herbs at a Glance" monographs — direct per-herb pages
 *   - MedlinePlus (NIH/NLM) — search fallback
 *   - NIH Office of Dietary Supplements (ODS) fact sheets — index
 *   - EMA HMPC (EU medicines agency) herbal monographs — index
 *   - WHO monographs — index
 *
 * Only NCCIH URLs that have been verified to resolve (HTTP 200) are mapped as
 * direct `monograph` links. Everything else is exposed as a `search` link that
 * always resolves, so we never present a fabricated or dead citation.
 *
 * IMPORTANT: surfacing a government source link does NOT mean the stored herb
 * row matches that source — the row may still be AI-generated. The page makes
 * that distinction explicit (see the "no government monograph matched"
 * notice). Actual data correction happens through the reviewer-in-the-loop
 * fetch script (scripts/fetch-gov-sources.ts), never by blind overwrite.
 */

export type GovSourceKind = "monograph" | "search" | "index";

export interface GovSource {
  /** Stable id, e.g. "nccih". */
  id: string;
  label: string;
  url: string;
  kind: GovSourceKind;
  /** "monograph" = a direct authoritative page for THIS herb; others are general. */
  authoritative: boolean;
}

interface SourceDef {
  id: string;
  label: string;
  indexUrl: string;
}

export const GOV_SOURCES: Record<string, SourceDef> = {
  nccih: {
    id: "nccih",
    label: "NCCIH (NIH)",
    indexUrl: "https://www.nccih.nih.gov/health/herbsataglance.htm",
  },
  medlineplus: {
    id: "medlineplus",
    label: "MedlinePlus (NIH)",
    indexUrl: "https://medlineplus.gov/druginfo/herb_All.html",
  },
  ods: {
    id: "ods",
    label: "NIH ODS Fact Sheets",
    indexUrl: "https://ods.od.nih.gov/factsheets/list-all/",
  },
  ema: {
    id: "ema",
    label: "EMA HMPC Monographs",
    indexUrl:
      "https://www.ema.europa.eu/en/medicines/field_26/herbal-medicines",
  },
  who: {
    id: "who",
    label: "WHO Monographs",
    indexUrl:
      "https://www.who.int/publications/who-monographs-on-selected-medicinal-plants",
  },
};

/**
 * Direct NCCIH "Herbs at a Glance" URLs, verified to return HTTP 200.
 * Keyed by the herb's database slug.
 */
const NCCIH_DIRECT: Record<string, string> = {
  turmeric: "https://www.nccih.nih.gov/health/turmeric",
  ginger: "https://www.nccih.nih.gov/health/ginger",
  echinacea: "https://www.nccih.nih.gov/health/echinacea",
  ginkgo: "https://www.nccih.nih.gov/health/ginkgo",
  "st-johns-wort": "https://www.nccih.nih.gov/health/st-johns-wort",
  valerian: "https://www.nccih.nih.gov/health/valerian",
  "milk-thistle": "https://www.nccih.nih.gov/health/milk-thistle",
  "black-cohosh": "https://www.nccih.nih.gov/health/black-cohosh",
  "saw-palmetto": "https://www.nccih.nih.gov/health/saw-palmetto",
  // NCCIH splits ginseng into Asian / American; the verified page is Asian ginseng.
  ginseng: "https://www.nccih.nih.gov/health/asian-ginseng",
  ashwagandha: "https://www.nccih.nih.gov/health/ashwagandha",
  cranberry: "https://www.nccih.nih.gov/health/cranberry",
  garlic: "https://www.nccih.nih.gov/health/garlic",
  "green-tea": "https://www.nccih.nih.gov/health/green-tea",
  kava: "https://www.nccih.nih.gov/health/kava",
  lavender: "https://www.nccih.nih.gov/health/lavender",
  "red-clover": "https://www.nccih.nih.gov/health/red-clover",
  rhodiola: "https://www.nccih.nih.gov/health/rhodiola",
  elderberry: "https://www.nccih.nih.gov/health/elderberry",
  "aloe-vera": "https://www.nccih.nih.gov/health/aloe-vera",
  astragalus: "https://www.nccih.nih.gov/health/astragalus",
  fenugreek: "https://www.nccih.nih.gov/health/fenugreek",
  feverfew: "https://www.nccih.nih.gov/health/feverfew",
  goldenseal: "https://www.nccih.nih.gov/health/goldenseal",
  hawthorn: "https://www.nccih.nih.gov/health/hawthorn",
  // NCCIH covers peppermint via its peppermint-oil page.
  peppermint: "https://www.nccih.nih.gov/health/peppermint-oil",
  chasteberry: "https://www.nccih.nih.gov/health/chasteberry",
};

/**
 * Resolve the authoritative government sources for a herb.
 *
 * @param slug herb database slug
 * @param displayName herb common name (used to build always-resolving search links)
 * @returns ordered list: direct monograph links first, then search/index fallbacks
 */
export function getGovSources(slug: string, displayName?: string): GovSource[] {
  const out: GovSource[] = [];
  const query = encodeURIComponent(displayName ?? slug.replace(/-/g, " "));

  const direct = NCCIH_DIRECT[slug];
  if (direct) {
    out.push({
      id: "nccih",
      label: "NCCIH (NIH) — Herbs at a Glance",
      url: direct,
      kind: "monograph",
      authoritative: true,
    });
  } else {
    // No direct page verified — offer a search that always resolves.
    out.push({
      id: "nccih",
      label: "Search NCCIH (NIH)",
      url: `https://www.nccih.nih.gov/search?query=${query}`,
      kind: "search",
      authoritative: false,
    });
  }

  out.push({
    id: "medlineplus",
    label: "Search MedlinePlus (NIH)",
    url: `https://medlineplus.gov/search/?q=${query}`,
    kind: "search",
    authoritative: false,
  });

  // General authoritative indexes (no per-herb page; always relevant).
  out.push({
    id: "ods",
    label: GOV_SOURCES.ods.label,
    url: GOV_SOURCES.ods.indexUrl,
    kind: "index",
    authoritative: false,
  });
  out.push({
    id: "ema",
    label: GOV_SOURCES.ema.label,
    url: GOV_SOURCES.ema.indexUrl,
    kind: "index",
    authoritative: false,
  });
  out.push({
    id: "who",
    label: GOV_SOURCES.who.label,
    url: GOV_SOURCES.who.indexUrl,
    kind: "index",
    authoritative: false,
  });

  return out;
}

/** True when at least one direct government monograph page is mapped. */
export function hasGovMonograph(slug: string): boolean {
  return Boolean(NCCIH_DIRECT[slug]);
}
