"use client";

import { CheckCircle2, ExternalLink } from "lucide-react";

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
  "Kew POWO": "https://powo.science.kew.org/",
  "Plants of the World Online": "https://powo.science.kew.org/",
  MPNS: "https://mpns.science.kew.org/",
  "Catalogue of Life": "https://www.catalogueoflife.org/",
  "Encyclopedia of Life": "https://eol.org/",
  "USDA PLANTS": "https://plants.usda.gov/",
  Wikidata: "https://www.wikidata.org/",
  "Taiwan FDA": "https://www.fda.gov.tw/ENG/",
  "Chinese Medicine Regulatory Office (HK)": "https://www.cmro.gov.hk/eng/",
  NCCIH: "https://www.nccih.nih.gov/",
  LiverTox: "https://www.ncbi.nlm.nih.gov/books/NBK548562/",
  MedlinePlus: "https://medlineplus.gov/",
  "WHO Monographs": "https://www.who.int/publications/i/item/9241545178",
};

function SourcePillList({
  names,
  muted = false,
}: {
  names: string[];
  muted?: boolean;
}) {
  return (
    <ul className="flex flex-wrap gap-2">
      {names.map((name) => {
        const href = SOURCE_URLS[name];
        const cls = muted
          ? "inline-flex items-center gap-1 rounded-full border border-neutral-200/80 px-2.5 py-0.5 text-xs text-neutral-500 hover:border-emerald-600 hover:text-emerald-800 dark:border-neutral-700/80 dark:text-neutral-400"
          : "inline-flex items-center gap-1 rounded-full border border-neutral-200 px-3 py-1 text-sm text-neutral-700 hover:border-emerald-600 hover:text-emerald-800 dark:border-neutral-700 dark:text-neutral-300";
        return (
          <li key={name}>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className={cls}
              >
                {name}
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            ) : (
              <span className={cls}>{name}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function HerbSourcesView({
  referenceSources,
  taxonomySources,
  historicalSources,
  countText,
  date,
  label,
  checkedLabel,
  taxonomyLabel,
  historicalLabel,
  note,
}: {
  referenceSources: string[];
  taxonomySources: string[];
  historicalSources: string[];
  countText: string;
  date: string | null;
  label: string;
  checkedLabel: string;
  taxonomyLabel: string;
  historicalLabel: string;
  note: string;
}) {
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

        {referenceSources.length > 0 && (
          <div className="mb-4">
            <SourcePillList names={referenceSources} />
          </div>
        )}

        <p className="text-sm text-neutral-500">
          {countText}
          {date ? ` · ${checkedLabel} ${date}` : null}
        </p>

        {taxonomySources.length > 0 && (
          <div className="mt-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
            <p className="mb-1.5 text-xs font-medium text-neutral-500">
              {taxonomyLabel}
            </p>
            <SourcePillList names={taxonomySources} muted />
          </div>
        )}

        {historicalSources.length > 0 && (
          <div className="mt-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
            <p className="mb-1.5 text-xs font-medium text-neutral-500">
              {historicalLabel}
            </p>
            <SourcePillList names={historicalSources} muted />
          </div>
        )}

        <p className="mt-2 text-xs leading-relaxed text-neutral-500">{note}</p>
      </div>
    </section>
  );
}
