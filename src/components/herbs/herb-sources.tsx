import { HerbSourcesView } from "@/components/herbs/herb-sources-view";

/**
 * The sources this entry was checked against.
 *
 * Rendered as a visible list rather than only a tooltip: it is the page's
 * evidence trail, it tells a reader (and a crawler) what the entry rests on, and
 * every entry's list is different — which is the honest kind of uniqueness.
 *
 * Links are resolved from a fixed map. An unknown source name is printed as
 * text, never as a guessed URL.
 */

const TAXONOMIC_SOURCES = new Set([
  "GBIF",
  "ITIS",
  "NCBI Taxonomy",
  "NCBI",
  "POWO",
  "Kew POWO",
  "Plants of the World Online",
  "MPNS",
  "Catalogue of Life",
  "Encyclopedia of Life",
  "USDA PLANTS",
  "Wikidata",
]);

const HISTORICAL_SOURCES = new Set([
  "US Dispensatory 1918",
  "US Dispensatory 1894",
  "King's American Dispensatory 1898",
  "Ellingwood's American Materia Medica 1919",
  "Fernie's Herbal Simples 1897",
]);

const REFERENCE_ALIASES: Record<string, string> = {
  EMA: "European Medicines Agency (HMPC)",
  "EMA HMPC": "European Medicines Agency (HMPC)",
  WHO: "WHO Monographs",
  "Health Canada": "Health Canada NHP",
};

function isHistoricalBook(name: string): boolean {
  if (HISTORICAL_SOURCES.has(name)) return true;
  return (
    /\b(1894|1897|1898|1918|1919)\b/.test(name) &&
    /(Dispensatory|Materia Medica|Herbal Simples)/i.test(name)
  );
}

/**
 * Split modern regulatory/clinical references from pure botanical taxonomy
 * registries and pre-modern historical archival texts, deduplicating aliases.
 */
export function partitionSources(sources: string[]): {
  referenceSources: string[];
  taxonomySources: string[];
  historicalSources: string[];
} {
  const seenRef = new Set<string>();
  const seenTax = new Set<string>();
  const seenHist = new Set<string>();
  const referenceSources: string[] = [];
  const taxonomySources: string[] = [];
  const historicalSources: string[] = [];

  for (const raw of sources) {
    const name = raw.trim();
    if (!name) continue;
    if (TAXONOMIC_SOURCES.has(name)) {
      if (!seenTax.has(name)) {
        seenTax.add(name);
        taxonomySources.push(name);
      }
    } else if (isHistoricalBook(name)) {
      if (!seenHist.has(name)) {
        seenHist.add(name);
        historicalSources.push(name);
      }
    } else {
      const canonical = REFERENCE_ALIASES[name] ?? name;
      if (!seenRef.has(canonical)) {
        seenRef.add(canonical);
        referenceSources.push(canonical);
      }
    }
  }
  return { referenceSources, taxonomySources, historicalSources };
}

export function HerbSources({
  sources,
  lastChecked,
  label = "Sources checked for this entry",
  checkedLabel = "Last checked",
  countLabel = (n: number) => `${n} independent sources`,
  taxonomyLabel = "Botanical identity confirmed via:",
  historicalLabel = "Historical archival texts (pre-modern, not clinical evidence):",
  note = "Cross-checked against these sources; where nothing was found, the page says so rather than filling the gap.",
}: {
  sources: string[];
  lastChecked?: string | null;
  label?: string;
  checkedLabel?: string;
  countLabel?: (n: number) => string;
  taxonomyLabel?: string;
  historicalLabel?: string;
  note?: string;
}) {
  const { referenceSources, taxonomySources, historicalSources } =
    partitionSources(sources);
  if (
    referenceSources.length === 0 &&
    taxonomySources.length === 0 &&
    historicalSources.length === 0
  ) {
    return null;
  }

  const parsedDate = lastChecked ? new Date(lastChecked) : null;
  const date =
    parsedDate && !Number.isNaN(parsedDate.getTime())
      ? parsedDate.toISOString().slice(0, 10)
      : null;

  return (
    <HerbSourcesView
      referenceSources={referenceSources}
      taxonomySources={taxonomySources}
      historicalSources={historicalSources}
      countText={countLabel(referenceSources.length)}
      date={date}
      label={label}
      checkedLabel={checkedLabel}
      taxonomyLabel={taxonomyLabel}
      historicalLabel={historicalLabel}
      note={note}
    />
  );
}
