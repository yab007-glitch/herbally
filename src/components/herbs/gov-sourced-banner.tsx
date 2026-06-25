import { Info } from "lucide-react";
import { getTranslations } from "next-intl/server";

/**
 * Shown on herb pages that have NO hand-written (human-authored) monograph.
 * Per the founder's decision (Option B), AI-generated narrative is not shown —
 * the page surfaces government sources + PubMed primary studies instead. This
 * banner makes that explicit so the thin page is understood, not mistaken for
 * missing content.
 */
export async function GovSourcedBanner() {
  const t = await getTranslations("govSources");
  return (
    <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
      <div className="flex items-start gap-3">
        <Info
          className="mt-0.5 size-5 shrink-0 text-amber-600"
          aria-hidden="true"
        />
        <div className="space-y-1 text-sm text-amber-900 dark:text-amber-100">
          <h2 className="text-base font-semibold">{t("stubTitle")}</h2>
          <p>{t("stubBody")}</p>
        </div>
      </div>
    </section>
  );
}
