import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Brief, impactful explainer of what a herb–drug interaction is and why it
 * matters, with real high-risk examples that double as internal links to those
 * herb pages. Shown on herb Safety tabs and on the /herb-drug-interactions SEO
 * landing page.
 *
 * Example herbs are hardcoded by slug; their display names + the effect text
 * are localized.
 */
const EXAMPLES = [
  { slug: "st-johns-wort", nameKey: "ex1Name", effectKey: "ex1Effect" },
  { slug: "garlic", nameKey: "ex2Name", effectKey: "ex2Effect" },
  { slug: "kava", nameKey: "ex3Name", effectKey: "ex3Effect" },
];

export function InteractionExplainer() {
  const t = useTranslations("interactionExplainer");
  return (
    <section
      className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 dark:border-amber-800/60 dark:bg-amber-950/20"
      aria-labelledby="interaction-explainer-title"
    >
      <h2
        id="interaction-explainer-title"
        className="flex items-center gap-2 text-lg font-semibold text-amber-900 dark:text-amber-200"
      >
        <AlertTriangle className="size-5 text-amber-600" aria-hidden="true" />
        {t("title")}
      </h2>

      <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-100/90">
        {t("whatIs")}
      </p>

      <p className="mt-3 text-sm font-medium text-amber-900 dark:text-amber-200">
        {t("whyHeading")}
      </p>
      <ul className="mt-1 space-y-1.5 text-sm text-amber-900/90 dark:text-amber-100/90">
        {EXAMPLES.map((ex) => (
          <li key={ex.slug} className="flex gap-1.5">
            <span aria-hidden="true">•</span>
            <span>
              <Link
                href={`/herbs/${ex.slug}`}
                className="font-semibold text-amber-800 underline decoration-amber-400 underline-offset-2 hover:text-amber-600 dark:text-amber-300"
              >
                {t(ex.nameKey)}
              </Link>{" "}
              {t(ex.effectKey)}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-sm text-amber-900/80 dark:text-amber-100/80">
        {t("riskLine")}
      </p>
      <p className="mt-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
        {t("actionLine")}
      </p>
    </section>
  );
}
