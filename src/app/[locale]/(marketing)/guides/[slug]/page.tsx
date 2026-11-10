import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale } from "@/lib/i18n/page-locale";
import { addLocalePrefix } from "@/lib/i18n/routing";
import { siteUrl } from "@/lib/seo/site-url";
import { BreadcrumbListSchema } from "@/components/seo/breadcrumb-list-schema";
import { WebPageSchema } from "@/components/seo/webpage-schema";
import { listGuides, getGuide } from "@/lib/guides/guides";

/**
 * A guide detail page.
 *
 * Drafts are `noindex` and carry a visible banner. Publishing is a human
 * action: flip `status` in `src/lib/guides/guides.ts` after a real review —
 * the robots tag, the banner and the sitemap entry all follow from that one
 * field, so the three cannot drift apart.
 */

const UI = {
  en: {
    back: "All guides",
    sources: "Sources",
    related: "Where to go next",
    draft: "Draft — not yet reviewed",
    draftBody:
      "This guide has not been reviewed by a human yet, so it is excluded from search. It is written from the same sourced data as the herb pages, and it makes no recommendation about what to take.",
    disclaimer:
      "Educational material, not medical advice. HerbAlly is not affiliated with the FDA or Health Canada. Confirm with your doctor or pharmacist before changing anything you take.",
    updated: "Last edited",
  },
  fr: {
    back: "Tous les guides",
    sources: "Sources",
    related: "Où aller ensuite",
    draft: "Brouillon — non révisé",
    draftBody:
      "Ce guide n’a pas encore été révisé par une personne ; il est donc exclu de la recherche. Il est écrit à partir des mêmes données sourcées que les fiches de plantes et ne recommande rien à prendre.",
    disclaimer:
      "Contenu éducatif, pas un avis médical. HerbAlly n’est affilié ni à la FDA ni à Santé Canada. Vérifiez avec votre médecin ou votre pharmacien avant de changer quoi que ce soit.",
    updated: "Dernière modification",
  },
} as const;

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  const locale = (await getLocale()) === "fr" ? "fr" : "en";
  if (!guide) return { title: "Guide not found", robots: { index: false } };

  const c = guide[locale];
  const base = siteUrl();
  const path = addLocalePrefix(`/guides/${guide.slug}`, locale);

  return {
    title: c.metaTitle,
    description: c.metaDescription,
    alternates: {
      canonical: `${base}${path}`,
      languages: {
        en: `${base}/guides/${guide.slug}`,
        fr: `${base}/fr/guides/${guide.slug}`,
        "x-default": `${base}/guides/${guide.slug}`,
      },
    },
    // A draft must never be indexed: nothing here has been reviewed.
    ...(guide.status === "draft"
      ? { robots: { index: false, follow: true } }
      : {}),
  };
}

export function generateStaticParams() {
  return listGuides().flatMap((guide) => [
    { locale: "en", slug: guide.slug },
    { locale: "fr", slug: guide.slug },
  ]);
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const locale = (await getLocale()) === "fr" ? "fr" : "en";
  const ui = UI[locale];
  const c = guide[locale];
  const base = siteUrl();
  const url = `${base}${addLocalePrefix(`/guides/${guide.slug}`, locale)}`;
  const home = `${base}${addLocalePrefix("/", locale)}`;
  const hub = `${base}${addLocalePrefix("/guides", locale)}`;

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <BreadcrumbListSchema
        items={[
          { name: locale === "fr" ? "Accueil" : "Home", url: home },
          { name: locale === "fr" ? "Guides" : "Guides", url: hub },
          { name: c.title, url },
        ]}
      />
      <WebPageSchema
        title={c.title}
        description={c.metaDescription}
        url={url}
        dateModified={guide.updated}
        breadcrumbs={[
          { name: locale === "fr" ? "Accueil" : "Home", url: home },
          { name: "Guides", url: hub },
          { name: c.title, url },
        ]}
      />

      <Link
        href="/guides"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← {ui.back}
      </Link>

      <h1 className="mt-4 text-3xl font-medium tracking-tight text-foreground">
        {c.title}
      </h1>
      <p className="mt-2 text-xs text-muted-foreground">
        {ui.updated}: {guide.updated}
      </p>

      {guide.status === "draft" ? (
        <div className="mt-4 rounded-xl border border-amber-300/70 bg-amber-50/60 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-semibold">{ui.draft}</p>
          <p className="mt-1">{ui.draftBody}</p>
        </div>
      ) : null}

      <p className="mt-6 text-sm leading-relaxed text-muted-foreground sm:text-base">
        {c.intro}
      </p>

      <div className="mt-8 space-y-7">
        {c.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-lg font-semibold text-foreground">
              {section.heading}
            </h2>
            {section.paragraphs.map((paragraph) => (
              <p
                key={paragraph.slice(0, 40)}
                className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base"
              >
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-foreground">{ui.sources}</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {c.sources.map((source) => (
            <li key={source.url}>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {source.label}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">{ui.related}</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {guide.related.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="inline-block rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
              >
                {locale === "fr" ? link.fr : link.en}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-10 text-xs leading-relaxed text-muted-foreground">
        {ui.disclaimer}
      </p>
    </article>
  );
}
