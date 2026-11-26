import { LocalizedLink as Link } from "@/components/i18n/localized-link";

/**
 * The accountability line under a herb page.
 *
 * Health content is judged on who stands behind it. The site's real author is
 * one named person with a health-science credential — that is a genuine trust
 * signal, and it was previously thrown away on a byline reading "HerbAlly
 * Editorial Team".
 *
 * It deliberately does NOT claim clinical review. Where no licensed clinician
 * has reviewed a page, the label says so; inventing a reviewer would destroy
 * the exact trust this line exists to build.
 */
export function AuthorByline({
  locale,
  lastReviewed,
  lastUpdated,
  isReviewed = true,
  isManualMonograph = false,
  sourceCount = 0,
  reviewerName,
  reviewerCredentials,
  herbSlug,
}: {
  locale: "en" | "fr";
  lastReviewed?: string | null;
  lastUpdated?: string | null;
  /** False for entries without a manual/clinical review so bylines do not overclaim. */
  isReviewed?: boolean;
  isManualMonograph?: boolean;
  sourceCount?: number;
  reviewerName?: string | null;
  reviewerCredentials?: string | null;
  herbSlug?: string | null;
}) {
  const reviewerSuffix =
    isReviewed && reviewerName
      ? `${reviewerName}${reviewerCredentials ? ` (${reviewerCredentials})` : ""}`
      : null;

  const formatSafeDate = (raw?: string | null) => {
    const parsed = raw ? new Date(raw) : null;
    if (
      !parsed ||
      Number.isNaN(parsed.getTime()) ||
      // eslint-disable-next-line react-hooks/purity
      parsed.getTime() > Date.now()
    ) {
      return null;
    }
    return parsed.toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "America/Toronto",
    });
  };

  const reviewedDate = isReviewed ? formatSafeDate(lastReviewed) : null;
  const updatedDate = formatSafeDate(
    lastUpdated ?? (!isReviewed ? lastReviewed : null)
  );

  const copy =
    locale === "fr"
      ? {
          sourceCheck:
            sourceCount > 0
              ? `Sources vérifiées : ${sourceCount}`
              : "Sources vérifiées : en attente",
          editorialStatus: isManualMonograph
            ? "Monographie éditoriale structurée"
            : "Compilation éditoriale",
          clinicalStatus: isReviewed
            ? reviewerSuffix
              ? `Révision clinique · ${reviewerSuffix}`
              : "Révision clinique au dossier"
            : "Non révisé par un clinicien",
          policy: "Politique éditoriale",
          updated: "Dernière mise à jour",
          reviewedOn: "Révision clinique le",
        }
      : {
          sourceCheck:
            sourceCount > 0
              ? `Source check: ${sourceCount} ${sourceCount === 1 ? "source" : "sources"}`
              : "Source check: Pending",
          editorialStatus: isManualMonograph
            ? "Curated monograph (Editorial compilation)"
            : "Editorial compilation",
          clinicalStatus: isReviewed
            ? reviewerSuffix
              ? `Clinically reviewed by ${reviewerSuffix}`
              : "Clinically reviewed"
            : "Not clinically reviewed",
          policy: "Editorial policy",
          updated: "Last updated",
          reviewedOn: "Clinically reviewed",
        };

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-y border-border py-4 text-[13px] text-muted-foreground">
      <span>{copy.sourceCheck}</span>
      <span aria-hidden="true">·</span>
      <span>{copy.editorialStatus}</span>
      <span aria-hidden="true">·</span>
      <span className="font-medium text-foreground">{copy.clinicalStatus}</span>
      <span aria-hidden="true">·</span>
      <Link
        href="/editorial-policy"
        className="underline underline-offset-2 hover:text-foreground"
      >
        {copy.policy}
      </Link>
      {updatedDate && (
        <>
          <span aria-hidden="true">·</span>
          <span>
            {copy.updated}: {updatedDate}
          </span>
        </>
      )}
      {reviewedDate && (
        <>
          <span aria-hidden="true">·</span>
          <span>
            {copy.reviewedOn}: {reviewedDate}
          </span>
        </>
      )}
      {herbSlug && (
        <>
          <span aria-hidden="true">·</span>
          <Link
            href={`/clinical-review?targetType=herb&slug=${herbSlug}`}
            rel="nofollow"
            className="underline underline-offset-2 hover:text-foreground"
          >
            {locale === "fr" ? "Suggérer une modification" : "Suggest an edit"}
          </Link>
        </>
      )}
    </div>
  );
}
