import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HerbCard } from "@/components/herbs/herb-card";
import { SmartSearch } from "@/components/herbs/smart-search";
import { SurpriseMeButton } from "@/components/herbs/surprise-me-button";
import { EmptyState } from "@/components/shared/empty-state";
import { DailyHerbBanner } from "@/components/herbs/daily-herb-banner";
import { getHerbs, getHerbCategories } from "@/lib/actions/herbs";
import { Flame, Stethoscope } from "lucide-react";
import Script from "next/script";
import { type Locale } from "@/lib/i18n/config";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "HerbAlly - Medicinal Herbs",
  description:
    "Browse our comprehensive database of 2,700+ medicinal herbs with detailed profiles, active compounds, and drug interactions.",
  openGraph: {
    title: "HerbAlly - Medicinal Herbs",
    description:
      "Browse 2,700+ medicinal herbs with detailed profiles, active compounds, and drug interactions.",
    url: "https://herbally.app/herbs",
    type: "website",
    siteName: "HerbAlly",
  },
};

// JSON-LD structured data for the herbs page
interface HerbForSchema {
  name: string;
  scientific_name: string;
  description: string;
  slug: string;
}

function generateStructuredData(herbs: HerbForSchema[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: herbs.map((herb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "MedicalWebPage",
        name: herb.name,
        alternateName: herb.scientific_name,
        description: herb.description,
        url: `https://herbally.app/herbs/${herb.slug || ""}`,
      },
    })),
  };
}

async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const savedLocale = cookieStore.get("herbally-locale")?.value;
  return (savedLocale === "fr" ? "fr" : "en") as Locale;
}

export default async function HerbsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = params.q || "";
  const category = params.category || "";
  const page = parseInt(params.page || "1", 10);
  const _locale = await getLocale();
  const t = await getTranslations();
  const [herbsResult, categoriesResult] = await Promise.all([
    getHerbs({ query, category, page }),
    getHerbCategories(),
  ]);

  const herbs = herbsResult.success ? herbsResult.data!.herbs : [];
  const total = herbsResult.success ? herbsResult.data!.total : 0;
  const categories = categoriesResult.success ? categoriesResult.data! : [];
  const totalPages = Math.ceil(total / 20);

  const structuredData = generateStructuredData(herbs);

  return (
    <div className="space-y-8">
      <Script
        id="herbs-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {/* Header */}
      <div className="text-center sm:text-left">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t("herbs.title")}
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          {t("herbs.subtitle")}
        </p>
      </div>

      {/* Smart Search */}
      <SmartSearch defaultValue={query} category={category} />

      {/* Daily Herb Banner */}
      {!query && !category && <DailyHerbBanner />}

      {/* Symptom-First Discovery */}
      {!query && !category && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-foreground">
                {t("herbs.dontKnowWhichHerb")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("herbs.dontKnowDesc")}
              </p>
            </div>
            <Link
              href="/symptoms"
              className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {t("herbs.findBysymptom")}
            </Link>
          </div>
        </div>
      )}

      {/* Popular Searches & Symptom Tags */}
      {!query && !category && (
        <div className="space-y-5">
          {/* Popular searches */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Flame className="size-4 text-orange-500" />
              <p className="text-sm font-medium text-foreground">
                {t("herbs.popularSearches")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { term: "turmeric", label: "Turmeric" },
                { term: "chamomile", label: "Chamomile" },
                { term: "ginger", label: "Ginger" },
                { term: "lavender", label: "Lavender" },
                { term: "echinacea", label: "Echinacea" },
              ].map((item) => (
                <Link
                  key={item.term}
                  href={`/herbs?q=${encodeURIComponent(item.term)}`}
                >
                  <Badge
                    variant="secondary"
                    aria-label={`Search for ${item.label}`}
                    className="cursor-pointer gap-1 transition-all hover:bg-primary/10 hover:text-primary"
                  >
                    <Flame className="size-3 text-orange-400" />
                    {item.label}
                  </Badge>
                </Link>
              ))}
              <SurpriseMeButton totalHerbs={total} />
            </div>
          </div>
        </div>
      )}

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        <Link href="/herbs">
          <Badge
            variant={!category ? "default" : "outline"}
            aria-label="Filter by all categories"
            className="cursor-pointer transition-all"
          >
            {t("herbs.all")}
          </Badge>
        </Link>
        {categories.map((cat: { slug: string; name: string }) => (
          <Link
            key={cat.slug}
            href={`/herbs?category=${cat.slug}${query ? `&q=${query}` : ""}`}
          >
            <Badge
              variant={category === cat.slug ? "default" : "outline"}
              aria-label={`Filter by ${cat.name}`}
              className="cursor-pointer transition-all hover:border-primary/50"
            >
              {cat.name}
            </Badge>
          </Link>
        ))}
      </div>

      {/* Search Results Label */}
      {query && herbs.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {t("herbs.resultsFound", { count: total, query })}
        </p>
      )}

      {/* Herbs Grid */}
      {herbs.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {herbs.map((herb) => (
            <HerbCard key={herb.id} herb={herb} />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <EmptyState
            variant="search"
            title={
              query ? t("herbs.noHerbsQuery", { query }) : t("herbs.noResults")
            }
            description={t("herbs.trySearching")}
            action={{ label: t("herbs.browseAll"), href: "/herbs" }}
          />
          {query && (
            <div className="text-center">
              <Link
                href="/symptoms"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Stethoscope className="size-4" />
                {t("herbs.browseSymptoms")}
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-6">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            render={
              page > 1 ? (
                <Link
                  href={`/herbs?page=${page - 1}${query ? `&q=${query}` : ""}${category ? `&category=${category}` : ""}`}
                />
              ) : undefined
            }
          >
            {t("herbs.pagination.previous")}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t("herbs.pagination.page")} {page} {t("herbs.pagination.of")}{" "}
            {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            render={
              page < totalPages ? (
                <Link
                  href={`/herbs?page=${page + 1}${query ? `&q=${query}` : ""}${category ? `&category=${category}` : ""}`}
                />
              ) : undefined
            }
          >
            {t("herbs.pagination.next")}
          </Button>
        </div>
      )}
    </div>
  );
}
