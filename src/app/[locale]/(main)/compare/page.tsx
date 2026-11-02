import type { Metadata } from "next";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { ArrowLeft, Leaf } from "lucide-react";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WebPageSchema } from "@/components/seo/webpage-schema";
import { BreadcrumbListSchema } from "@/components/seo/breadcrumb-list-schema";
import { getAnonClient } from "@/lib/supabase/anonymous";
import { siteUrl } from "@/lib/seo/site-url";
import { getLocale } from "@/lib/i18n/page-locale";
import { getTranslations } from "next-intl/server";
import { POPULAR_COMPARISONS } from "./[slug1]/vs/[slug2]/page";

/**
 * Hub for the herb-vs-herb comparisons.
 *
 * Twenty-two `/compare/a/vs/b` pages were in the sitemap with no parent page —
 * `/compare` returned 404, so the whole cluster was reachable only if a crawler
 * happened to find a deep link. This hub is the crawl parent and the internal
 * link source for that cluster; without it the pages are orphans.
 */
export const revalidate = 86400;

type NameRow = {
  slug: string;
  name: string;
  translations: Record<string, unknown> | null;
};

function localizedName(row: NameRow | undefined, fr: boolean): string {
  if (!row) return "";
  if (!fr) return row.name;
  const t = row.translations;
  if (!t || typeof t !== "object") return row.name;
  const frDict = (t as Record<string, unknown>).fr;
  if (!frDict || typeof frDict !== "object") return row.name;
  const name = (frDict as Record<string, unknown>).name;
  return typeof name === "string" && name.trim() ? name : row.name;
}

async function loadNames(fr: boolean): Promise<Map<string, string>> {
  const slugs = Array.from(
    new Set(POPULAR_COMPARISONS.flatMap((c) => [c.slug1, c.slug2]))
  );
  const map = new Map<string, string>();
  const supabase = getAnonClient();
  if (!supabase) return map;
  try {
    const { data } = await supabase
      .from("herbs")
      .select("slug,name,translations")
      .in("slug", slugs)
      .eq("is_published", true)
      .abortSignal(AbortSignal.timeout(15_000));
    for (const row of (data ?? []) as NameRow[]) {
      map.set(row.slug, localizedName(row, fr));
    }
  } catch {
    // Names are decoration — the links still work without them (see the
    // slug fallback below), so a slow database must not fail the page.
  }
  return map;
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const fr = locale === "fr";
  const baseUrl = siteUrl();
  const path = "/compare";
  const title = fr
    ? "Comparer deux plantes : différences, bienfaits et laquelle choisir"
    : "Compare Two Herbs: Differences, Benefits & Which to Choose";
  const description = fr
    ? "Comparaisons détaillées entre plantes médicinales : usages, posologie, grossesse et interactions médicamenteuses, avec les niveaux de preuve."
    : "Side-by-side comparisons of medicinal herbs: uses, dosage, pregnancy safety and drug interactions, with evidence grades for each claim.";
  return {
    title,
    description,
    alternates: {
      canonical: fr ? `${baseUrl}/fr${path}` : `${baseUrl}${path}`,
      languages: {
        en: `${baseUrl}${path}`,
        fr: `${baseUrl}/fr${path}`,
        "x-default": `${baseUrl}${path}`,
      },
    },
    openGraph: {
      title,
      description,
      url: fr ? `${baseUrl}/fr${path}` : `${baseUrl}${path}`,
      type: "website",
    },
  };
}

export default async function CompareHubPage() {
  const locale = await getLocale();
  const fr = locale === "fr";
  const t = await getTranslations({ locale });
  const baseUrl = siteUrl();
  const names = await loadNames(fr);

  const pairs = POPULAR_COMPARISONS.map(({ slug1, slug2 }) => ({
    slug1,
    slug2,
    name1: names.get(slug1) ?? slug1,
    name2: names.get(slug2) ?? slug2,
  }));

  const heading = fr ? "Comparer deux plantes" : "Compare two herbs";
  const intro = fr
    ? "Deux plantes qui semblent interchangeables ne le sont pas forcément. Ces comparaisons mettent côte à côte les usages, la posologie, la sécurité pendant la grossesse et les interactions médicamenteuses connues, avec le niveau de preuve derrière chaque affirmation."
    : "Two herbs that look interchangeable often are not. These comparisons put uses, dosage, pregnancy safety and known drug interactions side by side, with the evidence grade behind each claim.";

  return (
    <div className="space-y-8">
      <WebPageSchema
        type="CollectionPage"
        title={heading}
        description={intro}
        url={fr ? `${baseUrl}/fr/compare` : `${baseUrl}/compare`}
        breadcrumbs={[
          { name: "Home", url: baseUrl },
          { name: heading, url: `${baseUrl}/compare` },
        ]}
      />
      <BreadcrumbListSchema
        items={[
          { name: "Home", url: "/" },
          { name: heading, url: "/compare" },
        ]}
      />

      <Breadcrumbs
        items={[
          { name: t("common.breadcrumbHome"), href: "/" },
          { name: heading },
        ]}
      />

      <header className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {heading}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {intro}
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2">
        {pairs.map(({ slug1, slug2, name1, name2 }) => (
          <li key={`${slug1}-${slug2}`}>
            <Card className="h-full transition-colors hover:border-primary/40">
              <CardContent className="p-4">
                <Link
                  href={`/compare/${slug1}/vs/${slug2}`}
                  className="group block space-y-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="gap-1">
                      <Leaf className="size-3" />
                      {name1}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {fr ? "contre" : "vs"}
                    </span>
                    <Badge variant="secondary" className="gap-1">
                      <Leaf className="size-3" />
                      {name2}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium text-foreground group-hover:text-primary">
                    {fr
                      ? `${name1} ou ${name2} : quelles différences ?`
                      : `${name1} vs ${name2}: what's the difference?`}
                  </p>
                </Link>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/herb-drug-interactions"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          {fr ? "Interactions plante-médicament" : "Herb–drug interactions"}
        </Link>
        <Link
          href="/herbs"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <Leaf className="size-3.5" />
          {fr ? "Parcourir les 2 700 plantes" : "Browse all 2,700 herbs"}
        </Link>
      </div>
    </div>
  );
}
