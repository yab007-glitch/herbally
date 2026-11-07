import { CheckCircle2, ExternalLink } from "lucide-react";

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
const SOURCE_URLS: Record<string, string> = {
  "Health Canada LNHPD": "https://health-products.canada.ca/lnhpd-bdpsnh/",
  "European Medicines Agency (HMPC)":
    "https://www.ema.europa.eu/en/human-regulatory-overview/herbal-medicinal-products",
  PubMed: "https://pubmed.ncbi.nlm.nih.gov/",
  GBIF: "https://www.gbif.org/",
  ITIS: "https://www.itis.gov/",
  "NCBI Taxonomy": "https://www.ncbi.nlm.nih.gov/taxonomy",
  NCBI: "https://www.ncbi.nlm.nih.gov/taxonomy",
  POWO: "https://powo.science.kew.org/",
  "Plants of the World Online": "https://powo.science.kew.org/",
  MPNS: "https://mpns.science.kew.org/",
  "Catalogue of Life": "https://www.catalogueoflife.org/",
  "Encyclopedia of Life": "https://eol.org/",
  "USDA PLANTS": "https://plants.usda.gov/",
  "Taiwan FDA": "https://www.fda.gov.tw/ENG/",
  "Chinese Medicine Regulatory Office (HK)": "https://www.cmro.gov.hk/eng/",
  NCCIH: "https://www.nccih.nih.gov/",
  LiverTox: "https://www.ncbi.nlm.nih.gov/books/NBK548562/",
  MedlinePlus: "https://medlineplus.gov/",
  "WHO Monographs": "https://www.who.int/publications/i/item/9241545178",
};

export function HerbSources({
  sources,
  lastChecked,
  label = "Sources checked for this entry",
  checkedLabel = "Last checked",
  countLabel = (n: number) => `${n} independent sources`,
  note = "Identity and regulator records were cross-checked against these sources. A source being listed does not mean it covers every claim on the page — where nothing was found, the page says so rather than filling the gap.",
}: {
  sources: string[];
  lastChecked?: string | null;
  label?: string;
  checkedLabel?: string;
  countLabel?: (n: number) => string;
  note?: string;
}) {
  const clean = [...new Set(sources.map((s) => s.trim()).filter(Boolean))];
  if (clean.length === 0) return null;

  const date = lastChecked
    ? new Date(lastChecked).toISOString().slice(0, 10)
    : null;

  return (
    <section
      className="container mx-auto px-4 py-8"
      aria-labelledby="sources-heading"
    >
      <div className="mx-auto max-w-4xl rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-3 flex items-center gap-2">
          <CheckCircle2
            className="h-5 w-5 text-emerald-700 dark:text-emerald-400"
            aria-hidden="true"
          />
          <h2
            id="sources-heading"
            className="text-lg font-semibold text-neutral-900 dark:text-neutral-100"
          >
            {label}
          </h2>
        </div>

        <ul className="mb-4 flex flex-wrap gap-2">
          {clean.map((name) => {
            const href = SOURCE_URLS[name];
            return (
              <li key={name}>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-3 py-1 text-sm text-neutral-700 hover:border-emerald-600 hover:text-emerald-800 dark:border-neutral-700 dark:text-neutral-300"
                  >
                    {name}
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                ) : (
                  <span className="inline-flex rounded-full border border-neutral-200 px-3 py-1 text-sm text-neutral-700 dark:border-neutral-700 dark:text-neutral-300">
                    {name}
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <p className="text-sm text-neutral-500">
          {countLabel(clean.length)}
          {date ? ` · ${checkedLabel} ${date}` : null}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-neutral-500">{note}</p>
      </div>
    </section>
  );
}
