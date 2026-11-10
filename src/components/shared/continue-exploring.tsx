import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { Leaf, ShieldAlert, Stethoscope } from "lucide-react";
import { getAnonClient } from "@/lib/supabase/anonymous";
import { getLocale } from "@/lib/i18n/page-locale";

/**
 * End-of-page navigation for the tool routes (`/calculator`, `/herbalist`).
 *
 * Both are the site's highest-traffic landing pages and both dead-ended: a
 * visitor who arrived from a search for "herbal dosage calculator" had the
 * navigation bar and nothing else specific to click. The calculator page
 * carried 27 of 283 weekly visitors and linked to no herb, no interaction page
 * and no symptom page, which is a direct contributor to a 77% bounce rate.
 *
 * Popularity comes from `view_count`, which is coarse but real. A slow or
 * unreachable database must never fail the tool page, so a failed query
 * degrades to just the three cluster links.
 */

type PopularHerb = {
  slug: string;
  name: string;
  translations: Record<string, unknown> | null;
};

function localizedName(row: PopularHerb, fr: boolean): string {
  if (!fr) return row.name;
  const t = row.translations;
  if (!t || typeof t !== "object") return row.name;
  const frDict = (t as Record<string, unknown>).fr;
  if (!frDict || typeof frDict !== "object") return row.name;
  const name = (frDict as Record<string, unknown>).name;
  return typeof name === "string" && name.trim() ? name : row.name;
}

/**
 * Curated, not `view_count`-ordered. The counter is polluted by crawler hits on
 * random slugs — the raw top twelve began with `cay-xao-tam-phan` — so ordering
 * by it would present an obscure herb as the site's most-read. These are the
 * herbs people actually look up, which is what this rail is for.
 */
const POPULAR_SLUGS = [
  "turmeric",
  "ginger",
  "garlic",
  "st-johns-wort",
  "ashwagandha",
  "ginkgo-biloba",
  "milk-thistle",
  "echinacea",
  "chamomile",
  "valerian",
  "hawthorn",
  "cinnamon",
];

async function loadPopular(
  fr: boolean
): Promise<{ slug: string; name: string }[]> {
  const supabase = getAnonClient();
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from("herbs")
      .select("slug,name,translations")
      .in("slug", POPULAR_SLUGS)
      .eq("is_published", true)
      .abortSignal(AbortSignal.timeout(15_000));
    const bySlug = new Map(
      ((data ?? []) as PopularHerb[]).map((h) => [h.slug, localizedName(h, fr)])
    );
    // Curated order, not the database's return order.
    return POPULAR_SLUGS.filter((slug) => bySlug.has(slug)).map((slug) => ({
      slug,
      name: bySlug.get(slug) as string,
    }));
  } catch {
    return [];
  }
}

export async function ContinueExploring() {
  const locale = await getLocale();
  const fr = locale === "fr";
  const popular = await loadPopular(fr);

  const clusters = [
    {
      href: "/herb-drug-interactions",
      icon: ShieldAlert,
      label: fr ? "Vérifier une interaction" : "Check an interaction",
      hint: fr
        ? "Une plante et un médicament, avec les sources"
        : "One herb, one medicine, with the sources",
    },
    {
      href: "/symptoms",
      icon: Stethoscope,
      label: fr ? "Trouver une plante par symptôme" : "Find a herb by symptom",
      hint: fr
        ? "Anxiété, sommeil, digestion, douleur"
        : "Anxiety, sleep, digestion, pain",
    },
    {
      href: "/herbs",
      icon: Leaf,
      label: fr ? "Parcourir les 2 700 plantes" : "Browse all 2,700 herbs",
      hint: fr ? "Fiches, posologie, sécurité" : "Profiles, dosage, safety",
    },
  ];

  return (
    <section aria-labelledby="continue-exploring" className="space-y-4">
      <h2
        id="continue-exploring"
        className="text-xl font-semibold text-foreground"
      >
        {fr ? "Continuer l'exploration" : "Continue exploring"}
      </h2>

      <ul className="grid gap-3 sm:grid-cols-3">
        {clusters.map(({ href, icon: Icon, label, hint }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex h-full flex-col gap-1 rounded-xl border p-4 transition-colors hover:border-primary/40"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Icon className="size-4 text-primary" />
                {label}
              </span>
              <span className="text-xs text-muted-foreground">{hint}</span>
            </Link>
          </li>
        ))}
      </ul>

      {popular.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">
            {fr ? "Les plantes les plus consultées" : "Most-read herbs"}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {popular.map((herb) => (
              <li key={herb.slug}>
                <Link
                  href={`/herbs/${herb.slug}`}
                  className="inline-flex rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                >
                  {herb.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
