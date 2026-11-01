import Link from "next/link";

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
}: {
  locale: "en" | "fr";
  lastReviewed?: string | null;
}) {
  const copy =
    locale === "fr"
      ? {
          written: "Rédigé et maintenu par",
          name: "Yasser Bheekun",
          credentials: "Technologiste médical, OPTMQ · SCSLM",
          policy: "Politique éditoriale",
          updated: "Dernière mise à jour",
        }
      : {
          written: "Written and maintained by",
          name: "Yasser Bheekun",
          credentials: "Medical Laboratory Technologist, OPTMQ · CSMLS",
          policy: "Editorial policy",
          updated: "Last updated",
        };

  const date = lastReviewed
    ? new Date(lastReviewed).toLocaleDateString(
        locale === "fr" ? "fr-CA" : "en-CA",
        { year: "numeric", month: "long", day: "numeric" }
      )
    : null;

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-y border-border py-4 text-[13px] text-muted-foreground">
      <span>{copy.written}</span>
      <span className="font-medium text-foreground">{copy.name}</span>
      <span aria-hidden="true">·</span>
      <span>{copy.credentials}</span>
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
