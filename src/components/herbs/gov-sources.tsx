import { getTranslations } from "next-intl/server";
import {
  getGovSources,
  hasGovMonograph,
  type MonographSourceRef,
} from "@/lib/data/gov-sources";
import { getLocale } from "@/lib/i18n/page-locale";
import { GovSourcesView } from "@/components/herbs/gov-sources-view";

/**
 * Renders the authoritative government sources for a herb (NCCIH/NIH,
 * MedlinePlus, NIH ODS, EMA HMPC, WHO). Direct monograph links come first; when
 * no direct government monograph is mapped for the herb, an explicit notice is
 * shown so the AI-generated content is not mistaken for government-sourced.
 */
export async function GovSources({
  slug,
  displayName,
  monographSources,
}: {
  slug: string;
  displayName: string;
  monographSources?: MonographSourceRef[];
}) {
  const t = await getTranslations("govSources");
  const locale = (await getLocale()) === "fr" ? "fr" : "en";
  const sources = getGovSources(slug, displayName, locale, monographSources);
  const matched = hasGovMonograph(slug, monographSources);

  return (
    <GovSourcesView
      title={t("title")}
      noMonographNotice={matched ? null : t("noMonographNotice")}
      items={sources.map((s) => ({
        id: s.id,
        url: s.url,
        label: s.label,
        kindLabel:
          s.kind === "monograph"
            ? t("directMonograph")
            : s.kind === "search"
              ? t("searchFallback")
              : t("index"),
      }))}
    />
  );
}
