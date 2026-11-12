import { BookOpen, ExternalLink, ShieldAlert } from "lucide-react";

/**
 * NCCIH summary block.
 *
 * The text is reproduced from the NIH National Center for Complementary and
 * Integrative Health, a US federal body, so it is not subject to copyright
 * (17 U.S.C. §105). Attribution is still shown — the licence permits reuse, not
 * the pretence that we wrote it.
 *
 * Deliberately section-by-section and never paraphrased: the value of this block
 * is that a reader can check every line against the source in one click.
 */
export function NccihSummary({
  claims,
  safety,
  url,
  title,
  heading,
  sourceLabel = "National Center for Complementary and Integrative Health",
  licenceText = "US government works are not subject to copyright, so this text is reproduced in full rather than summarised.",
  claimsHeading = "Background and evidence",
  safetyHeading = "Safety, in the NIH's words",
  /**
   * The section's id. Two source blocks on one page (NCCIH and Health Canada
   * already, the public-domain books now) would otherwise both declare
   * "nccih-heading", and a document with duplicate ids fails validation.
   */
  id = "nccih-heading",
  notice = null,
  renderAs = "list",
  verbatimNote = null,
  expandLabel = "Show source text",
  reproducedLabel = "Reproduced verbatim from",
}: {
  claims:
    | (
        | string
        | { claim?: string; note?: string; text?: string; section?: string }
      )[]
    | null;
  safety: (string | { note?: string; text?: string })[] | null;
  url: string | null;
  title: string;
  /** Override the block heading, e.g. for a different regulator. */
  heading?: string;
  sourceLabel?: string;
  licenceText?: string;
  claimsHeading?: string;
  safetyHeading?: string;
  /** Section id, unique per source on the page. */
  id?: string;
  /**
   * A standing warning printed above the text. Set for sources written before
   * modern medicine, where the entry would otherwise read as advice.
   */
  notice?: string | null;
  /**
   * "prose" renders the claims as paragraphs instead of bullets, for sources
   * whose entries are running text rather than a list of findings.
   */
  renderAs?: "list" | "prose";
  /**
   * Set on a translated page: the quoted regulator text below stays in its
   * source language, and saying so is better than a silent language switch.
   */
  verbatimNote?: string | null;
  expandLabel?: string;
  reproducedLabel?: string;
}) {
  // Imported rows carry either a bare string or an object: NCCIH stores
  // {claim}/{note}, Health Canada stores {section, text}. Reading only the first
  // two made every Health Canada block render empty.
  const text = (
    v: string | { claim?: string; note?: string; text?: string }
  ): string =>
    typeof v === "string" ? v : (v.claim ?? v.note ?? v.text ?? "");
  const sectionOf = (v: string | { section?: string }): string | undefined =>
    typeof v === "string" ? undefined : v.section;
  const background = (claims ?? [])
    .map((v) => ({ text: text(v), section: sectionOf(v) }))
    .filter((v) => v.text);
  const safetyNotes = (safety ?? []).map(text).filter(Boolean);
  if (!background.length && !safetyNotes.length) return null;

  return (
    <section className="container mx-auto px-4 py-8" aria-labelledby={id}>
      <div className="mx-auto max-w-4xl rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-4 flex items-center gap-2">
          <BookOpen
            className="h-5 w-5 text-emerald-700 dark:text-emerald-400"
            aria-hidden="true"
          />
          <h2
            id={id}
            className="text-xl font-semibold text-neutral-900 dark:text-neutral-100"
          >
            {heading ?? `What the NIH says about ${title}`}
          </h2>
        </div>

        {notice && (
          <p className="mb-5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {notice}
          </p>
        )}

        {(() => {
          const lists = (
            <>
              {background.length > 0 && (
                <div className="mb-5">
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                    {claimsHeading}
                  </h3>
                  {renderAs === "prose" ? (
                    <div className="text-neutral-700 dark:text-neutral-300">
                      {background.map((line, i) => {
                        const previous = background[i - 1]?.section;
                        return (
                          <div key={i} className="mb-4">
                            {line.section && line.section !== previous && (
                              <h4 className="mb-1 text-sm font-semibold text-neutral-600 dark:text-neutral-400">
                                {line.section}
                              </h4>
                            )}
                            <p className="leading-relaxed">{line.text}</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <ul className="list-disc space-y-2 pl-5 text-neutral-700 dark:text-neutral-300">
                      {background.map((line, i) => (
                        <li key={i}>{line.text}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {safetyNotes.length > 0 && (
                <div className="mb-5">
                  <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                    <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                    {safetyHeading}
                  </h3>
                  <ul className="list-disc space-y-2 pl-5 text-neutral-700 dark:text-neutral-300">
                    {safetyNotes.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          );

          // On a translated page the quotation stays in its source language,
          // so it opens collapsed: the page reads in the reader's language and
          // the regulator's own words are one click away, still labelled.
          if (!verbatimNote) return lists;
          return (
            <>
              <p className="mb-3 rounded-lg bg-neutral-100 px-3 py-2 text-xs leading-relaxed text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                {verbatimNote}
              </p>
              <details className="mb-5 rounded-lg border border-neutral-200 dark:border-neutral-800">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  {expandLabel}
                </summary>
                <div className="px-3 pb-1">{lists}</div>
              </details>
            </>
          );
        })()}

        <p className="border-t border-neutral-200 pt-4 text-sm text-neutral-500 dark:border-neutral-800">
          {reproducedLabel}{" "}
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1 text-emerald-700 underline hover:text-emerald-800 dark:text-emerald-400"
            >
              {sourceLabel}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          ) : (
            sourceLabel
          )}
          . {licenceText}
        </p>
      </div>
    </section>
  );
}
