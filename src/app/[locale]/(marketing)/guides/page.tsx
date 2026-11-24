import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/page-locale";
import { buildAlternateUrls } from "@/lib/i18n/routing";
import { siteUrl } from "@/lib/seo/site-url";
import { BreadcrumbListSchema } from "@/components/seo/breadcrumb-list-schema";
import { listGuides } from "@/lib/guides/guides";
import { getReviewer } from "@/lib/data/reviewers";

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
    metaTitle: "Herbal Safety & Evidence Guides",
    metaDescription:
      "How to read herb evidence, check an interaction safely, decode a Health Canada NPN label, avoid surgery and liver risks, and use herbal products wisely.",
    intro:
      "Longer explanations of the things individual herb sheets can only summarise: how to read an evidence grade, what a checker result really means, how Canadian NPN labels work, and where the clinical limits sit.",
    provenanceNotice:
      "Editorially reviewed by Yasser Bheekun, MLT (OPTMQ · CSMLS) against primary regulatory and clinical monographs (Health Canada, NIH NCCIH, LiverTox, EMA HMPC). Educational information only — not medical advice.",
    reviewedTag: "Reviewed",
    readMore: "Read the guide",
    draft: "Draft — not yet reviewed",
    crumbs: ["Home", "Guides"],
    back: "All guides",
  },
  fr: {
    title: "Guides",
    metaTitle: "Guides sur les plantes et preuves",
    metaDescription:
      "Comment lire les preuves sur les plantes, vérifier une interaction, décoder un NPN de Santé Canada et limiter les risques hépatiques, opératoires ou en grossesse.",
    intro:
      "Des explications approfondies sur ce que les fiches de plantes ne peuvent que résumer : lire un niveau de preuve, interpréter un résultat d’interaction, comprendre les numéros NPN de Santé Canada et cerner les limites cliniques.",
    provenanceNotice:
      "Révision éditoriale par Yasser Bheekun, T.M. (OPTMQ · SCSLM) à partir des monographies officielles (Santé Canada, NIH NCCIH, LiverTox, EMA HMPC). Contenu éducatif — ne remplace pas un avis médical.",
    reviewedTag: "Révisé",
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
    // A child page without its own openGraph inherits the root layout's, whose
    // url is the homepage. Restate it so shares point at the guides index.
    openGraph: {
      title: c.metaTitle,
      description: c.metaDescription,
      url: alternates[locale],
      type: "website",
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: c.metaTitle,
        },
      ],
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
      <p className="mt-4 rounded-xl border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
        {c.provenanceNotice}
      </p>

      <ul className="mt-8 space-y-4">
        {guides.map((guide) => {
          const g = guide[locale];
          const reviewer = getReviewer(guide.reviewedBy);
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
                ) : reviewer ? (
                  <span className="rounded-full border border-green-300 bg-green-50 px-2 py-0.5 text-[11px] text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300">
                    {c.reviewedTag} · {reviewer.name}
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
