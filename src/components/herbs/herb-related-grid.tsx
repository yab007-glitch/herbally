import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { InternalLinkRail } from "@/components/herbs/internal-link-rail";
import type { LinkHerb } from "@/lib/data/internal-links";
import type { Guide } from "@/lib/guides/types";
import type { CopyLocale } from "@/lib/i18n/herb-page-copy";

export function HerbRelatedSection({
  locale,
  herbSlug,
  interactions,
  prev,
  next,
  symptomPeers,
  relatedHerbs,
  relatedHeading,
  relatedGuides = [],
}: {
  locale: CopyLocale;
  herbSlug: string;
  interactions: Array<{
    drug_name: string;
    display_drug_name?: string;
    severity: string;
  }>;
  prev: LinkHerb | null;
  next: LinkHerb | null;
  symptomPeers: LinkHerb[];
  relatedHerbs: Array<{ name: string; slug: string; scientific_name: string }>;
  relatedHeading: string;
  relatedGuides?: Guide[];
}) {
  return (
    <>
      <section aria-labelledby="internal-links-heading" className="pt-4">
        <h2 id="internal-links-heading" className="sr-only">
          {locale === "fr"
            ? "Autres plantes et interactions"
            : "More herbs and interactions"}
        </h2>
        <InternalLinkRail
          locale={locale}
          herbSlug={herbSlug}
          interactions={interactions}
          prev={prev}
          next={next}
          peers={symptomPeers}
        />
      </section>

      {relatedGuides.length > 0 && (
        <section aria-labelledby="related-guides-heading" className="pt-4">
          <h2
            id="related-guides-heading"
            className="mb-3 text-xl font-semibold text-foreground"
          >
            {locale === "fr"
              ? "Guides de sécurité associés"
              : "Related safety guides"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {relatedGuides.map((guide) => {
              const gCopy = locale === "fr" ? guide.fr : guide.en;
              return (
                <Link
                  key={guide.slug}
                  href={`/guides/${guide.slug}`}
                  className="group rounded-2xl border p-4 transition-colors hover:border-primary/40 hover:bg-muted/40"
                >
                  <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    {gCopy.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {gCopy.metaDescription}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {relatedHerbs.length > 0 && (
        <section aria-labelledby="related-herbs-heading" className="pt-4">
          <h2
            id="related-herbs-heading"
            className="mb-4 text-xl font-semibold text-foreground"
          >
            {relatedHeading}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {relatedHerbs.map((related) => {
              const showName =
                related.name.trim().toLowerCase() !==
                related.scientific_name.trim().toLowerCase();
              return (
                <Link
                  key={related.slug}
                  href={`/herbs/${related.slug}`}
                  className="group rounded-2xl border p-4 transition-colors hover:bg-muted/50"
                >
                  <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                    {showName ? related.name : related.scientific_name}
                  </h3>
                  {showName && related.scientific_name && (
                    <p className="text-sm italic text-muted-foreground">
                      {related.scientific_name}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
