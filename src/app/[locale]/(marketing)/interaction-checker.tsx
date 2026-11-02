import { getTranslations } from "next-intl/server";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { cn } from "@/lib/utils";
import { HomeSearchClient } from "./home-search-client";

interface InteractionCheckerProps {
  className?: string;
  /** The "browse all herbs" link belongs on the home hero, not on a page
   *  whose job is the checker itself. */
  showBrowseLink?: boolean;
}

/**
 * The herb + medication checker, with its label set.
 *
 * Extracted so the home hero and /herb-drug-interactions render the same
 * tool instead of one page linking to the other. Thirty translation keys
 * duplicated in two files is how the two copies drift apart.
 */
export async function InteractionChecker({
  className,
  showBrowseLink = true,
}: InteractionCheckerProps) {
  const t = await getTranslations();

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/70 bg-card/70 p-4 shadow-[0_1px_0_rgba(0,0,0,0.02)] sm:p-5",
        className
      )}
    >
      <HomeSearchClient
        labels={{
          herbLabel: t("home.herbLabel"),
          medLabel: t("home.medLabel"),
          herbPlaceholder: t("home.herbPlaceholder"),
          medPlaceholder: t("home.medPlaceholder"),
          checkButton: t("home.checkButton"),
          suggestionsTitle: t("home.suggestionsTitle"),
          suggestion1: t("home.suggestion1"),
          suggestion2: t("home.suggestion2"),
          suggestion3: t("home.suggestion3"),
          suggestion4: t("home.suggestion4"),
          trustLine: t("home.trustLine"),
          symptomsLink: t("home.symptomsLink"),
          emptyCheckError: t("home.emptyCheckError"),
          sameCheckError: t("home.sameCheckError"),
          checking: t("home.checkerChecking"),
          checkerFoundTitle: t("home.checkerFoundTitle"),
          checkerAskHerbalist: t("home.checkerAskHerbalist"),
          checkerViewPair: t("home.checkerViewPair"),
          checkerViewHerb: t("home.checkerViewHerb"),
          checkerDisclaimer: t("home.checkerDisclaimer"),
          checkerNotFoundTitle: t("home.checkerNotFoundTitle"),
          // Raw: the client substitutes {herb}/{drug} itself, and passing the
          // message through ICU formatting here throws FORMATTING_ERROR for
          // the variables it never receives.
          checkerNotFoundBody: t.raw("home.checkerNotFoundBody"),
          checkerAiNote: t("home.checkerAiNote"),
          checkerError: t("home.checkerError"),
          checkerSource: t("home.checkerSource"),
          checkerEvidence: t("home.checkerEvidence"),
          checkerMechanism: t("home.checkerMechanism"),
          severityMild: t("interactions.severity.mild"),
          severityModerate: t("interactions.severity.moderate"),
          severitySevere: t("interactions.severity.severe"),
          severityContraindicated: t("interactions.severity.contraindicated"),
        }}
      />

      {showBrowseLink && (
        <div className="mt-4">
          <Link
            href="/herbs"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("home.heroButton")} →
          </Link>
        </div>
      )}
    </div>
  );
}
