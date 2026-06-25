import { ExternalLink, Landmark } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getGovSources, hasGovMonograph } from "@/lib/data/gov-sources";

/**
 * Renders the authoritative government sources for a herb (NCCIH/NIH,
 * MedlinePlus, NIH ODS, EMA HMPC, WHO). Direct monograph links come first; when
 * no direct government monograph is mapped for the herb, an explicit notice is
 * shown so the AI-generated content is not mistaken for government-sourced.
 *
 * This is the credibility layer Dawn Wong asked for: every herb page points to
 * the real government source of truth, and is honest when none covers it.
 */
export async function GovSources({
  slug,
  displayName,
}: {
  slug: string;
  displayName: string;
}) {
  const t = await getTranslations("govSources");
  const sources = getGovSources(slug, displayName);
  const matched = hasGovMonograph(slug);

  return (
    <section className="rounded-lg border bg-muted/30 p-4 text-sm">
      <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
        <Landmark className="size-4 text-primary" aria-hidden="true" />
        {t("title")}
      </h3>

      {!matched && (
        <p className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
          {t("noMonographNotice")}
        </p>
      )}

      <ul className="space-y-1.5">
        {sources.map((s) => (
          <li key={s.id + s.url} className="flex items-start gap-2">
            <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              {s.label}
            </a>
            <span className="text-xs text-muted-foreground">
              {s.kind === "monograph"
                ? t("directMonograph")
                : s.kind === "search"
                  ? t("searchFallback")
                  : t("index")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
