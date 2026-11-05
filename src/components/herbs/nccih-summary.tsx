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
}: {
  claims: (string | { claim?: string })[] | null;
  safety: (string | { note?: string })[] | null;
  url: string | null;
  title: string;
}) {
  const text = (v: string | { claim?: string; note?: string }): string =>
    typeof v === "string" ? v : (v.claim ?? v.note ?? "");
  const background = (claims ?? []).map(text).filter(Boolean);
  const safetyNotes = (safety ?? []).map(text).filter(Boolean);
  if (!background.length && !safetyNotes.length) return null;

  return (
    <section
      className="container mx-auto px-4 py-8"
      aria-labelledby="nccih-heading"
    >
      <div className="mx-auto max-w-4xl rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-4 flex items-center gap-2">
          <BookOpen
            className="h-5 w-5 text-emerald-700 dark:text-emerald-400"
            aria-hidden="true"
          />
          <h2
            id="nccih-heading"
            className="text-xl font-semibold text-neutral-900 dark:text-neutral-100"
          >
            What the NIH says about {title}
          </h2>
        </div>

        {background.length > 0 && (
          <div className="mb-5">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Background and evidence
            </h3>
            <ul className="list-disc space-y-2 pl-5 text-neutral-700 dark:text-neutral-300">
              {background.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        {safetyNotes.length > 0 && (
          <div className="mb-5">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              Safety, in the NIH&apos;s words
            </h3>
            <ul className="list-disc space-y-2 pl-5 text-neutral-700 dark:text-neutral-300">
              {safetyNotes.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="border-t border-neutral-200 pt-4 text-sm text-neutral-500 dark:border-neutral-800">
          Reproduced verbatim from the{" "}
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1 text-emerald-700 underline hover:text-emerald-800 dark:text-emerald-400"
            >
              National Center for Complementary and Integrative Health
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          ) : (
            "National Center for Complementary and Integrative Health"
          )}
          , part of the US National Institutes of Health. US government works
          are not subject to copyright, so this text is reproduced in full
          rather than summarised.
        </p>
      </div>
    </section>
  );
}
