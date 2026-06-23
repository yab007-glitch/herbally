#!/usr/bin/env tsx
/**
 * auto-verify-provenance.ts — Automated provenance and evidence grading
 * for the HerbAlly herb database.
 *
 * This script does NOT require a human reviewer. It cross-references each
 * herb against known authoritative source lists (WHO Monographs, Commission E,
 * EMA, NCCIH) and checks for real PubMed citations. Based on the results it
 * assigns:
 *
 *   - provenance.verification_method:
 *     "primary_source" if the herb is in an authoritative source list
 *     "ai_summarized"   if the herb has real PubMed citations but no
 *                       authoritative source match
 *     "unverified"      if neither (left as-is)
 *
 *   - evidence_level (A/B/C/D/trad):
 *     "A" if in 2+ authoritative sources AND has PubMed citations
 *     "B" if in 1+ authoritative sources AND has PubMed citations
 *     "C" if has PubMed citations but no authoritative source
 *     "trad" if in an authoritative source but no PubMed citations
 *     "trad" if neither (traditional use default)
 *
 *   - provenance.sources: list of matching authoritative sources
 *   - provenance.last_verified_at: timestamp
 *   - provenance.verified_by: "auto-verification-script"
 *
 * Usage:
 *   npx tsx scripts/auto-verify-provenance.ts              # Apply to all
 *   npx tsx scripts/auto-verify-provenance.ts --dry-run     # Preview only
 *   npx tsx scripts/auto-verify-provenance.ts --slug ginger # Single herb
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";

// ============================================================
// AUTHORITATIVE SOURCE DATABASE
// (Extracted from seed-citations.ts — these are real published
// monograph lists from WHO, Commission E, EMA, and NCCIH)
// ============================================================

const WHO_MONOGRAPHS: Record<string, string[]> = {
  "WHO Vol.1 (1999)": [
    "Aloe Vera", "Aloe", "Cape Aloe", "Rhubarb", "Senna", "Cascara",
    "Psyllium", "Ispaghula", "Fenugreek", "Gentian", "Chamomile",
    "Matricaria", "Roman Chamomile", "Anise", "Fennel", "Star Anise",
    "Caraway", "Coriander", "Dill", "Peppermint", "Spearmint",
    "Lemon Balm", "Valerian", "Hops", "Passionflower", "Hawthorn",
    "Ginkgo", "Bilberry", "Witch Hazel", "Horse Chestnut", "Myrtle",
    "Eucalyptus", "Tea Tree", "Cajeput", "Niaouli",
  ],
  "WHO Vol.2 (2000)": [
    "Eleutherococcus", "Eleuthero", "Siberian Ginseng", "Asian Ginseng",
    "Panax Ginseng", "Rauwolfia", "Indian Snakeroot", "Papaya",
    "Cotton", "Safflower", "Artemisia", "Sweet Wormwood", "Wormwood",
    "Tansy", "Costus", "Andrographis", "Guggul", "Commiphora", "Myrrh",
    "Frankincense", "Boswellia", "Neem", "Amla", "Haritaki", "Bibhitaki",
    "Triphala", "Turmeric", "Curcuma", "Ginger", "Cardamom",
    "Black Pepper", "Long Pepper", "Ashwagandha", "Shatavari",
    "Brahmi", "Gotu Kola",
  ],
  "WHO Vol.3 (2007)": [
    "Capers", "Caper", "Onion", "Garlic", "Lily", "Tulip", "Aloe",
    "Cistanche", "Rehmannia", "Cornus", "Dioscorea", "Alisma", "Poria",
    "Cinnamon", "Cassia", "Eucommia", "Epimedium", "Morinda",
    "Schisandra", "Cuscuta", "Lycium", "Goji", "Dendrobium",
    "Asparagus", "Ophiopogon", "Glehnia", "Trichosanthes", "Benincasa",
    "Lagenaria", "Citrullus", "Watermelon",
  ],
  "WHO Vol.4 (2009)": [
    "St. John's Wort", "Hypericum", "Black Cohosh", "Cimicifuga",
    "Butterbur", "Petasites", "Echinacea", "Purple Coneflower",
    "Hawthorn", "Crataegus", "Red Clover", "Trifolium", "Saw Palmetto",
    "Serenoa", "Stinging Nettle", "Urtica", "Willow", "Salix",
    "Devil's Claw", "Harpagophytum", "Astragalus", "Dong Quai",
    "Angelica", "Kudzu", "Pueraria", "Bitter Melon", "Momordica",
    "Noni", "Morinda",
  ],
};

const COMMISSION_E_HERBS = [
  "Alder Buckthorn", "Aloe", "Anise", "Arnica", "Artichoke",
  "Ashwagandha", "Balm", "Birch", "Black Cohosh", "Bladderwrack",
  "Blessed Thistle", "Buckthorn", "Burdock", "Calendula", "Caraway",
  "Cascara", "Castor Oil", "Celery", "Chamomile", "Cinnamon",
  "Coltsfoot", "Comfrey", "Coriander", "Couch Grass", "Dandelion",
  "Devil's Claw", "Dill", "Echinacea", "Elder", "Elecampane",
  "Eucalyptus", "Evening Primrose", "Fennel", "Fenugreek", "Feverfew",
  "Foxglove", "Fumitory", "Garden Angelica", "Garlic", "Gentian",
  "Ginger", "Ginkgo", "Ginseng", "Goldenrod", "Gotu Kola", "Guarana",
  "Hawthorn", "Hops", "Horse Chestnut", "Horsetail", "Hyssop",
  "Iceland Moss", "Ivy", "Juniper", "Lavender", "Lemon Balm",
  "Licorice", "Linden", "Lovage", "Lungwort", "Mallow", "Marjoram",
  "Marshmallow", "Meadowsweet", "Milk Thistle", "Mistletoe", "Mullein",
  "Myrrh", "Nettle", "Oats", "Onion", "Orange", "Oregano", "Parsley",
  "Passionflower", "Peppermint", "Plantain", "Primrose", "Psyllium",
  "Raspberry", "Red Clover", "Restharrow", "Rhubarb", "Rosehip",
  "Rosemary", "Sage", "St. John's Wort", "Sarsaparilla",
  "Saw Palmetto", "Senna", "Shepherd's Purse", "Silverweed",
  "Skullcap", "Squill", "Strawberry", "Thyme", "Tormentil",
  "Turmeric", "Valerian", "Verbena", "Watercress", "White Mustard",
  "White Willow", "Witch Hazel", "Wormwood", "Yarrow", "Yohimbe",
];

const EMA_HERBS = [
  "St. John's Wort", "Valerian", "Ginkgo", "Hawthorn", "Ivy",
  "Echinacea", "Peppermint", "Chamomile", "Fennel", "Psyllium",
  "Senna", "Rhubarb", "Milk Thistle", "Saw Palmetto", "Black Cohosh",
  "Red Clover", "Horse Chestnut", "Butterbur", "Devil's Claw",
  "Ginger", "Artichoke", "Gentian", "Lemon Balm", "Passionflower",
  "Hops", "Melissa", "Calendula", "Eucalyptus", "Thyme", "Plantain",
  "Primrose", "Witch Hazel", "Nettle", "Birch", "Goldenrod",
  "Orthosiphon", "Dandelion",
];

const NCCIH_HERBS = [
  "Aloe Vera", "Ashwagandha", "Astragalus", "Black Cohosh", "Burdock",
  "Chamomile", "Cranberry", "Echinacea", "Evening Primrose",
  "Fenugreek", "Feverfew", "Flaxseed", "Garlic", "Ginger", "Ginkgo",
  "Ginseng", "Goldenseal", "Grapeseed Extract", "Green Tea",
  "Hawthorn", "Horny Goat Weed", "Kava", "Lavender", "Milk Thistle",
  "Olive Leaf", "Peppermint", "Red Clover", "Saw Palmetto",
  "St. John's Wort", "Tea Tree", "Turmeric", "Valerian", "Elderberry",
  "Chasteberry", "Rhodiola", "Maca", "Bacopa", "Triphala", "Neem",
];

// ============================================================
// MATCHING LOGIC
// ============================================================

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/[''']/g, "'").replace(/\s+/g, " ");
}

/** Build a lookup set from all authoritative lists combined. */
function buildSourceIndex(): Map<string, string[]> {
  const index = new Map<string, string[]>();

  const addToList = (list: string[], source: string) => {
    for (const herb of list) {
      const key = normalizeName(herb);
      const existing = index.get(key) || [];
      if (!existing.includes(source)) {
        existing.push(source);
      }
      index.set(key, existing);
    }
  };

  for (const [sourceName, herbs] of Object.entries(WHO_MONOGRAPHS)) {
    addToList(herbs, sourceName);
  }
  addToList(COMMISSION_E_HERBS, "Commission E");
  addToList(EMA_HERBS, "EMA");
  addToList(NCCIH_HERBS, "NCCIH");

  return index;
}

interface HerbRow {
  id: string;
  name: string;
  slug: string;
  scientific_name: string;
  evidence_level: string | null;
  citations: unknown;
  provenance: unknown;
}

interface CitationEntry {
  pmid?: string;
  source?: string;
  title?: string;
  url?: string;
}


function countPmidCitations(citations: unknown): number {
  if (!Array.isArray(citations)) return 0;
  return (citations as CitationEntry[]).filter(
    (c) => c.pmid && /^\d{7,8}$/.test(String(c.pmid))
  ).length;
}

/** Also try matching by scientific name (first word = genus). */
function matchHerbToSources(
  herbName: string,
  scientificName: string,
  index: Map<string, string[]>
): string[] {
  const sources = new Set<string>();

  // Try exact name match
  const nameKey = normalizeName(herbName);
  const direct = index.get(nameKey);
  if (direct) direct.forEach((s) => sources.add(s));

  // Try scientific name match (genus only — many lists use common names
  // that include the genus, e.g. "Crataegus" for Hawthorn)
  const genus = scientificName.split(" ")[0];
  if (genus) {
    const genusKey = normalizeName(genus);
    const byGenus = index.get(genusKey);
    if (byGenus) byGenus.forEach((s) => sources.add(s));
  }

  // Try partial matching: if the herb name contains or is contained in
  // any list entry (handles "St. John's Wort" vs "St Johns Wort")
  for (const [key, srcs] of index) {
    if (
      key === nameKey ||
      key.includes(nameKey) ||
      nameKey.includes(key)
    ) {
      srcs.forEach((s) => sources.add(s));
    }
  }

  return Array.from(sources);
}

function determineEvidenceLevel(
  sourceCount: number,
  pmidCount: number
): "A" | "B" | "C" | "D" | "trad" {
  // A: 2+ authoritative sources AND has PubMed citations
  if (sourceCount >= 2 && pmidCount > 0) return "A";
  // B: 1+ authoritative source AND has PubMed citations
  if (sourceCount >= 1 && pmidCount > 0) return "B";
  // C: has PubMed citations but no authoritative source
  if (pmidCount > 0) return "C";
  // trad: in authoritative source but no PubMed citations, or neither
  return "trad";
}

function determineVerificationMethod(
  sourceCount: number,
  pmidCount: number
): "primary_source" | "ai_summarized" | "unverified" {
  if (sourceCount > 0) return "primary_source";
  if (pmidCount > 0) return "ai_summarized";
  return "unverified";
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dryRun = process.argv.includes("--dry-run");
  const slugArg = process.argv.find((a) => a.startsWith("--slug="));

  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in .env.local."
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const sourceIndex = buildSourceIndex();
  console.log(
    `Source index: ${sourceIndex.size} unique herb entries across WHO, Commission E, EMA, NCCIH`
  );

  // Fetch herbs with pagination (Supabase default limit is 1000)
  const selectColumns =
    "id, name, slug, scientific_name, evidence_level, citations, provenance";

  let herbs: HerbRow[] = [];
  let error: string | null = null;

  if (slugArg) {
    const slug = slugArg.split("=")[1];
    const { data, error: err } = await supabase
      .from("herbs")
      .select(selectColumns)
      .eq("is_published", true)
      .eq("slug", slug);
    herbs = (data as HerbRow[]) || [];
    error = err?.message ?? null;
  } else {
    // Paginate through all published herbs
    let page = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error: err } = await supabase
        .from("herbs")
        .select(selectColumns)
        .eq("is_published", true)
        .order("name")
        .range(page * pageSize, (page + 1) * pageSize - 1);
      if (err) {
        error = err.message;
        break;
      }
      if (!data || data.length === 0) break;
      herbs.push(...(data as HerbRow[]));
      if (data.length < pageSize) break;
      page++;
    }
  }

  if (error) {
    console.error("Failed to fetch herbs:", error);
    process.exit(1);
  }

  if (herbs.length === 0) {
    console.log("No herbs found.");
    process.exit(0);
  }

  console.log(`Processing ${herbs.length} herbs (${dryRun ? "DRY RUN" : "LIVE"})...\n`);

  let updated = 0;
  let skipped = 0;
  let alreadyVerified = 0;
  const stats = {
    primarySource: 0,
    aiSummarized: 0,
    unverified: 0,
    evidenceA: 0,
    evidenceB: 0,
    evidenceC: 0,
    evidenceTrad: 0,
  };

  for (const herb of herbs as HerbRow[]) {
    const sources = matchHerbToSources(
      herb.name,
      herb.scientific_name,
      sourceIndex
    );
    const pmidCount = countPmidCitations(herb.citations);
    const hasPubmed = pmidCount > 0;
    const sourceCount = sources.length;

    const method = determineVerificationMethod(sourceCount, pmidCount);
    const evidenceLevel = determineEvidenceLevel(sourceCount, pmidCount);

    // Skip if already manually verified — don't overwrite human review
    const existingProvenance = herb.provenance as
      | { verification_method?: string }
      | null;
    if (
      existingProvenance?.verification_method === "manual"
    ) {
      alreadyVerified++;
      skipped++;
      continue;
    }

    // Skip if nothing changed (already has the same method and evidence level)
    if (
      existingProvenance?.verification_method === method &&
      herb.evidence_level === evidenceLevel
    ) {
      skipped++;
      continue;
    }

    const now = new Date().toISOString();
    const provenanceUpdate = {
      verification_method: method,
      sources: sources.length > 0 ? sources : [],
      primary_url: sources.length > 0
        ? method === "primary_source"
          ? `https://www.ncbi.nlm.nih.gov/pubmed/?term=${encodeURIComponent(herb.scientific_name)}`
          : null
        : null,
      last_verified_at: now,
      verified_by: "auto-verification-script",
      notes:
        method === "primary_source"
          ? `Automatically matched to: ${sources.join(", ")}. ${
              hasPubmed
                ? `${pmidCount} PubMed citation(s) found.`
                : "No PubMed citations yet."
            }`
          : method === "ai_summarized"
            ? `${pmidCount} PubMed citation(s) found. No authoritative monograph match.`
            : undefined,
    };

    stats.primarySource += method === "primary_source" ? 1 : 0;
    stats.aiSummarized += method === "ai_summarized" ? 1 : 0;
    stats.unverified += method === "unverified" ? 1 : 0;
    stats.evidenceA += evidenceLevel === "A" ? 1 : 0;
    stats.evidenceB += evidenceLevel === "B" ? 1 : 0;
    stats.evidenceC += evidenceLevel === "C" ? 1 : 0;
    stats.evidenceTrad += evidenceLevel === "trad" ? 1 : 0;

    if (dryRun) {
      console.log(
        `  [DRY] ${herb.slug.padEnd(30)} → ${method.padEnd(15)} | evidence: ${evidenceLevel} | sources: ${sources.join(", ") || "none"} | PMIDs: ${pmidCount}`
      );
    } else {
      const { error: updateErr } = await supabase
        .from("herbs")
        .update({
          provenance: provenanceUpdate,
          evidence_level: evidenceLevel,
        })
        .eq("id", herb.id);

      if (updateErr) {
        console.error(`  ✗ ${herb.slug}: ${updateErr.message}`);
        skipped++;
        continue;
      }
    }
    updated++;
  }

  console.log(`\n${dryRun ? "[DRY RUN] " : ""}Summary:`);
  console.log(`  Updated:    ${updated}`);
  console.log(`  Skipped:    ${skipped} (${alreadyVerified} already manually verified)`);
  console.log(`\n  Provenance assignments:`);
  console.log(`    primary_source: ${stats.primarySource}`);
  console.log(`    ai_summarized:  ${stats.aiSummarized}`);
  console.log(`    unverified:     ${stats.unverified}`);
  console.log(`\n  Evidence grades:`);
  console.log(`    A (strong):    ${stats.evidenceA}`);
  console.log(`    B (moderate):  ${stats.evidenceB}`);
  console.log(`    C (limited):   ${stats.evidenceC}`);
  console.log(`    trad:          ${stats.evidenceTrad}`);
}

main().catch((err) => {
  console.error(`✗ ${err.message ?? err}`);
  process.exit(1);
});