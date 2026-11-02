import Link from "next/link";
import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/page-locale";
import { buildAlternateUrls } from "@/lib/i18n/routing";
import { siteUrl } from "@/lib/seo/site-url";
import { BreadcrumbListSchema } from "@/components/seo/breadcrumb-list-schema";
import { listGuides } from "@/lib/guides/guides";

/**
 * Guides hub (SEO brief, Workstream F). `/blog` does not exist in this repo, so
 * the hub is `/guides`.
 *
 * Nothing here is published yet: every guide is a draft until a human reviews
 * it (Workstream E). The hub itself is indexable because it lists what exists
 * and is honest about the state of each entry.
 */
const COPY = {
  en: {
    title: "Guides",
    metaTitle: "Guides",
    metaDescription:
      "How to read herb evidence, check an interaction safely, use the dosage calculator, and understand herb–drug interactions — written for readers, not for search engines.",
    intro:
      "Longer explanations of the things the herb pages can only summarise: how to read an evidence grade, what a checker result really means, and where the limits are. Every guide is an evidence overview, not a recommendation, and each one is marked with its review status.",
    draftNotice:
      "Drafts. These guides have not been reviewed by a human yet, so they are excluded from search on purpose. What they say follows the same sourced data as the rest of the site.",
    readMore: "Read the guide",
    draft: "Draft — not yet reviewed",
    crumbs: ["Home", "Guides"],
    back: "All guides",
  },
  fr: {
    title: "Guides",
    metaTitle: "Guides",
    metaDescription:
      "Comment lire les preuves sur les plantes, vérifier une interaction sans se tromper, utiliser le calculateur de posologie et comprendre les interactions plante-médicament.",
    intro:
      "Des explications plus longues sur ce que les fiches de plantes ne peuvent que résumer : comment lire un niveau de preuve, ce que signifie vraiment un résultat de vérificateur, et où sont les limites. Chaque guide est un survol des preuves, pas une recommandation, et porte son état de révision.",
    draftNotice:
      "Brouillons. Ces guides n’ont pas encore été révisés par une personne ; ils sont donc volontairement exclus de la recherche. Leur contenu suit les mêmes données sourcées que le reste du site.",
    readMore: "Lire le guide",
    draft: "Brouillon — non révisé",
    crumbs: ["Accueil", "Guides"],
    back: "Tous les guides",
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) === "fr" ? "fr" : "en";
  const c = COPY[locale];
  const alternates = buildAlternateUrls("/guides", siteUrl());
  return {
    title: c.metaTitle,
    description: c.metaDescription,
    alternates: {
      canonical: alternates[locale],
      languages: {
        en: alternates.en,
        fr: alternates.fr,
        "x-default": alternates["x-default"],
      },
    },
  };
}

export default async function GuidesIndexPage() {
  const locale = (await getLocale()) === "fr" ? "fr" : "en";
  const c = COPY[locale];
  const guides = listGuides();
  const base = siteUrl();
  const prefix = locale === "fr" ? "/fr" : "";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <BreadcrumbListSchema
        items={[
          { name: c.crumbs[0], url: `${base}${prefix}` },
          { name: c.crumbs[1], url: `${base}${prefix}/guides` },
        ]}
      />
      <h1 className="text-3xl font-medium tracking-tight text-foreground">
        {c.title}
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
        {c.intro}
      </p>
      <p className="mt-4 rounded-xl border border-amber-300/70 bg-amber-50/60 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
        {c.draftNotice}
      </p>

      <ul className="mt-8 space-y-4">
        {guides.map((guide) => {
          const g = guide[locale];
          return (
            <li
              key={guide.slug}
              className="rounded-2xl border bg-card p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">
                  <Link
                    href={`/guides/${guide.slug}`}
                    className="hover:text-primary"
                  >
                    {g.title}
                  </Link>
                </h2>
                {guide.status === "draft" ? (
                  <span className="rounded-full border border-amber-400 px-2 py-0.5 text-[11px] text-amber-800 dark:text-amber-300">
                    {c.draft}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {g.intro}
              </p>
              <Link
                href={`/guides/${guide.slug}`}
                className="mt-3 inline-block text-sm text-primary hover:underline"
              >
                {c.readMore} →
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
