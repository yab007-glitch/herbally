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
  isReviewed = true,
  reviewerName,
  reviewerCredentials,
  herbSlug,
}: {
  locale: "en" | "fr";
  lastReviewed?: string | null;
  /** False for entries without a manual/clinical review so bylines do not overclaim. */
  isReviewed?: boolean;
  reviewerName?: string | null;
  reviewerCredentials?: string | null;
  herbSlug?: string | null;
}) {
  const reviewerSuffix =
    isReviewed && reviewerName
      ? `${reviewerName}${reviewerCredentials ? ` (${reviewerCredentials})` : ""}`
      : null;
  const copy =
    locale === "fr"
      ? {
          label: isReviewed
            ? reviewerSuffix
              ? `Révision clinique · ${reviewerSuffix}`
              : "Révision clinique au dossier"
            : "Compilation éditoriale · Non révisé par un clinicien",
          policy: "Politique éditoriale",
          updated: "Dernière mise à jour",
        }
      : {
          label: isReviewed
            ? reviewerSuffix
              ? `Clinically reviewed by ${reviewerSuffix}`
              : "Clinically reviewed"
            : "Editorial compilation · Not clinically reviewed",
          policy: "Editorial policy",
          updated: "Last updated",
        };

  // Format in the site's home timezone, not the server's. The server runs in
  // UTC, so an update saved at 21:00 in Montreal (01:00 UTC the next day)
  // rendered "Last updated: November 16" on November 15 — a future date on
  // hundreds of pages, which reads as fabricated.
  //
  // A date in the future is never shown. Some rows carry an updated_at ahead
  // of today (data import), and "Last updated: 2027" reads as fabricated.
  const parsedDate = lastReviewed ? new Date(lastReviewed) : null;
  const date =
    parsedDate &&
    !Number.isNaN(parsedDate.getTime()) &&
    // This is a server component: the render timestamp is the right value, and
    // there is no re-render or hydration to make it unstable. The purity rule
    // exists for client components.
    // eslint-disable-next-line react-hooks/purity
    parsedDate.getTime() <= Date.now()
      ? parsedDate.toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", {
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "America/Toronto",
        })
      : null;

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-y border-border py-4 text-[13px] text-muted-foreground">
      <span className="font-medium text-foreground">{copy.label}</span>
      <span aria-hidden="true">·</span>
      <Link
        href="/editorial-policy"
        className="underline underline-offset-2 hover:text-foreground"
      >
        {copy.policy}
      </Link>
      {date && (
        <>
          <span aria-hidden="true">·</span>
          <span>
            {copy.updated}: {date}
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
            {locale === "fr"
              ? "Proposer une modification clinique"
              : "Suggest a clinical edit"}
          </Link>
        </>
      )}
    </div>
  );
}
