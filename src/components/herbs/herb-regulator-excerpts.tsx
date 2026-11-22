import { NccihSummary } from "@/components/herbs/nccih-summary";
import type { MonographSourceRow } from "@/lib/herbs/herb-page-data";
import { herbPageCopy } from "@/lib/i18n/herb-page-copy";

export function HerbRegulatorExcerpts({
  herbName,
  sources,
  copy,
  filter = "all",
  isDangerous = false,
  locale = "en",
}: {
  herbName: string;
  sources: MonographSourceRow[];
  copy: ReturnType<typeof herbPageCopy>;
  filter?: "all" | "modern" | "historical";
  isDangerous?: boolean;
  locale?: "en" | "fr";
}) {
  const filtered = sources.filter((source) => {
    const isHist = Boolean(copy.historicalSources[source.source]);
    if (isHist && isDangerous) return false;
    if (filter === "modern") return !isHist;
    if (filter === "historical") return isHist;
    return true;
  });

  if (filtered.length === 0) return null;

  const historicalCollapseLabel =
    locale === "fr"
      ? "Afficher le texte d'archive historique (1894–1919 — ne constitue pas un avis médical)"
      : "Show historical 1894–1919 archive text (not modern medical advice)";

  return (
    <>
      {filtered.map((source) => {
        const historical = copy.historicalSources[source.source];
        const labels =
          source.source === "LiverTox"
            ? {
                heading: copy.liverTox.heading(herbName),
                sourceLabel: copy.liverTox.sourceLabel,
                licenceText: copy.liverTox.licenceText,
                claimsHeading: copy.liverTox.claimsHeading,
                safetyHeading: copy.liverTox.safetyHeading,
              }
            : source.source === "Health Canada"
              ? {
                  heading: copy.healthCanada.heading(herbName),
                  sourceLabel: copy.healthCanada.sourceLabel,
                  licenceText: copy.healthCanada.licenceText,
                  claimsHeading: copy.healthCanada.claimsHeading,
                  safetyHeading: copy.healthCanada.safetyHeading,
                }
              : source.source === "European Medicines Agency (HMPC)"
                ? {
                    heading: copy.ema.heading(herbName),
                    sourceLabel: copy.ema.sourceLabel,
                    licenceText: copy.ema.licenceText,
                    claimsHeading: copy.ema.claimsHeading,
                    safetyHeading: copy.ema.safetyHeading,
                  }
                : historical
                  ? {
                      heading: historical.heading(herbName),
                      sourceLabel: historical.sourceLabel,
                      licenceText: historical.licenceText,
                      claimsHeading: historical.claimsHeading,
                      safetyHeading: historical.safetyHeading,
                    }
                  : {
                      heading: copy.nccih.heading(herbName),
                      sourceLabel: copy.nccih.sourceLabel,
                      licenceText: copy.nccih.licenceText,
                      claimsHeading: copy.nccih.claimsHeading,
                      safetyHeading: copy.nccih.safetyHeading,
                    };

        return (
          <NccihSummary
            key={source.source}
            id={`source-${source.source.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
            claims={source.claims as unknown as (string | { text?: string })[]}
            safety={source.safety as unknown as (string | { text?: string })[]}
            url={source.url}
            title={herbName}
            notice={historical?.notice ?? null}
            renderAs={historical ? "prose" : "list"}
            verbatimNote={copy.verbatimQuoteNote}
            expandLabel={copy.verbatimExpandLabel}
            reproducedLabel={copy.reproducedLabel}
            collapsible={Boolean(historical)}
            collapseSummary={historical ? historicalCollapseLabel : undefined}
            {...labels}
          />
        );
      })}
    </>
  );
}
