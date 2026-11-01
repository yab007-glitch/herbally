import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { LinkHerb } from "@/lib/data/internal-links";
import { pairPath } from "@/lib/interactions/pair-url";

const COPY = {
  en: {
    interactionsTitle: "Interactions on this page",
    neighbours: "Previous and next in the herb index",
    previous: "Previous",
    next: "Next",
    peers: "Herbs with related uses",
  },
  fr: {
    interactionsTitle: "Interactions sur cette page",
    neighbours: "Précédent et suivant dans l'index",
    previous: "Précédent",
    next: "Suivant",
    peers: "Plantes aux usages proches",
  },
} as const;

/**
 * Internal links off a herb page.
 *
 * Three rails, because one was not enough and zero is what the site had:
 * the pairs that already belong to this herb, the A–Z neighbours (structure,
 * always present), and herbs sharing a symptom keyword (relevance that
 * actually varies across the library).
 */
export function InternalLinkRail({
  locale,
  herbSlug,
  interactions,
  prev,
  next,
  peers,
}: {
  locale: "en" | "fr";
  herbSlug: string;
  interactions: { drug_name: string; severity: string }[];
  prev: LinkHerb | null;
  next: LinkHerb | null;
  peers: LinkHerb[];
}) {
  const c = COPY[locale];
  const pairs = interactions.slice(0, 6);
  const hasNeighbours = Boolean(prev || next);

  if (pairs.length === 0 && !hasNeighbours && peers.length === 0) return null;

  return (
    <div className="space-y-8">
      {pairs.length > 0 && (
        <section aria-labelledby="pair-links-heading">
          <h2 id="pair-links-heading" className="eyebrow mb-3">
            {c.interactionsTitle}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {pairs.map((pair) => (
              <li key={pair.drug_name}>
                <Link
                  href={pairPath(herbSlug, pair.drug_name)}
                  className="flex items-center justify-between gap-3 rounded-sm border border-border px-3 py-2 text-sm text-foreground transition-colors hover:border-primary hover:bg-accent"
                >
                  <span>{pair.drug_name}</span>
                  <span className="text-xs capitalize text-muted-foreground">
                    {pair.severity}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {peers.length > 0 && (
        <section aria-labelledby="peer-links-heading">
          <h2 id="peer-links-heading" className="eyebrow mb-3">
            {c.peers}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {peers.map((peer) => (
              <li key={peer.slug}>
                <Link
                  href={`/herbs/${peer.slug}`}
                  className="inline-block rounded-full border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary hover:bg-accent"
                >
                  {peer.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasNeighbours && (
        <nav
          aria-label={c.neighbours}
          className="flex items-stretch justify-between gap-3 border-t border-border pt-4"
        >
          {prev ? (
            <Link
              href={`/herbs/${prev.slug}`}
              rel="prev"
              className="group flex min-w-0 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-[11px] uppercase tracking-wide">
                  {c.previous}
                </span>
                <span className="block truncate font-medium text-foreground">
                  {prev.name}
                </span>
              </span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={`/herbs/${next.slug}`}
              rel="next"
              className="group flex min-w-0 items-center gap-2 text-right text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <span className="min-w-0">
                <span className="block text-[11px] uppercase tracking-wide">
                  {c.next}
                </span>
                <span className="block truncate font-medium text-foreground">
                  {next.name}
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
