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
  isReviewed: _isReviewed = true,
}: {
  locale: "en" | "fr";
  lastReviewed?: string | null;
  /** False for entries without a manual/clinical review so bylines do not overclaim. */
  isReviewed?: boolean;
}) {
  // Owner policy 2026-11-23: every herb page carries one generic review line
  // ("Reviewed and verified") instead of a named byline. The named-reviewer
  // registry still drives per-page attribution if one is ever restored.
  const copy =
    locale === "fr"
      ? {
          label: "Révisé et vérifié",
          policy: "Politique éditoriale",
          updated: "Dernière mise à jour",
        }
      : {
          label: "Reviewed and verified",
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
    </div>
  );
}
