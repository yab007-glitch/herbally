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
 * The NCCIH direct URLs were discovered from the official "Herbs at a Glance"
 * index (https://www.nccih.nih.gov/health/herbsataglance.htm) and each mapped
 * to the matching HerbAlly database slug (by common name, then scientific name
 * for synonym herbs, e.g. ginkgo-biloba -> NCCIH "ginkgo"). Only pages that
 * exist in the NCCIH index are mapped — no fabricated URLs.
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
 * Direct NCCIH "Herbs at a Glance" URLs, discovered from the official NCCIH
 * index and mapped to HerbAlly database slugs (54 herbs). Keyed by slug.
 */
const NCCIH_DIRECT: Record<string, string> = {
  "acai-berry-antioxidant": "https://www.nccih.nih.gov/health/acai",
  "aloe-vera": "https://www.nccih.nih.gov/health/aloe-vera",
  ashwagandha: "https://www.nccih.nih.gov/health/ashwagandha",
  astragalus: "https://www.nccih.nih.gov/health/astragalus",
  bilberry: "https://www.nccih.nih.gov/health/bilberry",
  "bitter-orange": "https://www.nccih.nih.gov/health/bitter-orange",
  "black-cohosh": "https://www.nccih.nih.gov/health/black-cohosh",
  boswellia: "https://www.nccih.nih.gov/health/boswellia",
  butterbur: "https://www.nccih.nih.gov/health/butterbur",
  "cats-claw": "https://www.nccih.nih.gov/health/cats-claw",
  chamomile: "https://www.nccih.nih.gov/health/chamomile",
  cinnamon: "https://www.nccih.nih.gov/health/cinnamon",
  "cook-island-noni-leaf": "https://www.nccih.nih.gov/health/noni",
  "corynanthe-yohimbe": "https://www.nccih.nih.gov/health/yohimbe",
  cranberry: "https://www.nccih.nih.gov/health/cranberry",
  dandelion: "https://www.nccih.nih.gov/health/dandelion",
  echinacea: "https://www.nccih.nih.gov/health/echinacea",
  elderberry: "https://www.nccih.nih.gov/health/elderberry",
  "ephedra-sinica": "https://www.nccih.nih.gov/health/ephedra",
  "european-mistletoe": "https://www.nccih.nih.gov/health/european-mistletoe",
  "evening-primrose": "https://www.nccih.nih.gov/health/evening-primrose-oil",
  fenugreek: "https://www.nccih.nih.gov/health/fenugreek",
  feverfew: "https://www.nccih.nih.gov/health/feverfew",
  "flaxseed-oil-herb":
    "https://www.nccih.nih.gov/health/flaxseed-and-flaxseed-oil",
  garcinia: "https://www.nccih.nih.gov/health/garcinia-cambogia",
  garlic: "https://www.nccih.nih.gov/health/garlic",
  ginger: "https://www.nccih.nih.gov/health/ginger",
  "ginkgo-biloba": "https://www.nccih.nih.gov/health/ginkgo",
  ginseng: "https://www.nccih.nih.gov/health/asian-ginseng",
  goldenseal: "https://www.nccih.nih.gov/health/goldenseal",
  "grape-seed": "https://www.nccih.nih.gov/health/grape-seed-extract",
  "green-tea": "https://www.nccih.nih.gov/health/green-tea",
  hawthorn: "https://www.nccih.nih.gov/health/hawthorn",
  hoodia: "https://www.nccih.nih.gov/health/hoodia",
  "horse-chestnut": "https://www.nccih.nih.gov/health/horse-chestnut",
  kava: "https://www.nccih.nih.gov/health/kava",
  lavender: "https://www.nccih.nih.gov/health/lavender",
  "licorice-root": "https://www.nccih.nih.gov/health/licorice-root",
  "milk-thistle": "https://www.nccih.nih.gov/health/milk-thistle",
  "mugwort-european": "https://www.nccih.nih.gov/health/mugwort",
  "mulberry-leaf": "https://www.nccih.nih.gov/health/white-mulberry-leaf",
  passionflower: "https://www.nccih.nih.gov/health/passionflower",
  peppermint: "https://www.nccih.nih.gov/health/peppermint-oil",
  "pomegranate-peel": "https://www.nccih.nih.gov/health/pomegranate",
  "red-clover": "https://www.nccih.nih.gov/health/red-clover",
  rhodiola: "https://www.nccih.nih.gov/health/rhodiola",
  sage: "https://www.nccih.nih.gov/health/sage",
  "saw-palmetto": "https://www.nccih.nih.gov/health/saw-palmetto",
  "st-johns-wort": "https://www.nccih.nih.gov/health/st-johns-wort",
  "tea-tree": "https://www.nccih.nih.gov/health/tea-tree-oil",
  "tripterygium-wilfordii": "https://www.nccih.nih.gov/health/thunder-god-vine",
  turmeric: "https://www.nccih.nih.gov/health/turmeric",
  valerian: "https://www.nccih.nih.gov/health/valerian",
  vitex: "https://www.nccih.nih.gov/health/chasteberry",
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
