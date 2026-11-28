import {
  HerbRegulatorExcerptsView,
  type RegulatorExcerptItem,
} from "@/components/herbs/herb-regulator-excerpts-view";
import type { MonographSourceRow } from "@/lib/herbs/herb-page-data";
import { herbPageCopy } from "@/lib/i18n/herb-page-copy";

function normalizeClaims(
  raw: unknown
): Array<string | { text?: string; section?: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<string | { text?: string; section?: string }> = [];
  for (const item of raw) {
    if (typeof item === "string") {
      if (item) out.push(item);
    } else if (item && typeof item === "object") {
      const o = item as {
        claim?: string;
        note?: string;
        text?: string;
        section?: string;
      };
      const text = o.claim ?? o.note ?? o.text ?? "";
      if (!text) continue;
      out.push(o.section ? { text, section: o.section } : text);
    }
  }
  return out;
}

function normalizeSafety(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      if (item) out.push(item);
    } else if (item && typeof item === "object") {
      const o = item as { note?: string; text?: string };
      const text = o.note ?? o.text ?? "";
      if (text) out.push(text);
    }
  }
  return out;
}

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

  const items: RegulatorExcerptItem[] = filtered
    .map((source) => {
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

      const claims = isDangerous ? [] : normalizeClaims(source.claims);
      const safety = normalizeSafety(source.safety);
      const totalChars =
        claims.reduce(
          (sum, c) =>
            sum + (typeof c === "string" ? c.length : (c.text?.length ?? 0)),
          0
        ) + safety.reduce((sum, s) => sum + s.length, 0);
      const isVerboseModernExcerpt = !historical && totalChars > 1000;

      return {
        key: source.source,
        id: `source-${source.source.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        claims,
        safety,
        url: source.url,
        notice: historical?.notice ?? null,
        renderAs: historical ? "prose" : "list",
        collapsible: Boolean(historical) || isVerboseModernExcerpt,
        collapseSummary: isVerboseModernExcerpt
          ? locale === "fr"
            ? `Source réglementaire primaire (${labels.sourceLabel}) — Afficher l'extrait intégral (${claims.length + safety.length} points)`
            : `Primary Regulatory Source (${labels.sourceLabel}) — Expand full verbatim excerpt (${claims.length + safety.length} sections)`
          : undefined,
        ...labels,
      } satisfies RegulatorExcerptItem;
    })
    .filter((item) => item.claims.length > 0 || item.safety.length > 0);

  if (items.length === 0) return null;

  return (
    <HerbRegulatorExcerptsView
      herbName={herbName}
      items={items}
      verbatimNote={copy.verbatimQuoteNote}
      expandLabel={copy.verbatimExpandLabel}
      reproducedLabel={copy.reproducedLabel}
      collapseSummary={historicalCollapseLabel}
    />
  );
}
