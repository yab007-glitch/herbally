import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HerbCard } from "@/components/herbs/herb-card";
import { SmartSearch } from "@/components/herbs/smart-search";
import { EmptyState } from "@/components/shared/empty-state";
import { DailyHerbBanner } from "@/components/herbs/daily-herb-banner";
import { RecentlyViewed } from "@/components/herbs/recently-viewed";
import { getHerbs, getHerbCategories } from "@/lib/actions/herbs";
import { type Locale } from "@/lib/i18n/config";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Medicinal Herbs",
  description:
    "Browse 2,700+ medicinal herbs with detailed profiles, active compounds, and drug interactions.",
  openGraph: {
    title: "Medicinal Herbs — HerbAlly",
    description:
      "Browse 2,700+ medicinal herbs with detailed profiles, active compounds, and drug interactions.",
    url: "https://herbally.app/herbs",
    type: "website",
    siteName: "HerbAlly",
  },
};

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
  const t = await getTranslations({locale: "en"});
  const [herbsResult, categoriesResult] = await Promise.all([
    getHerbs({ query, category, page }),
    getHerbCategories(),
  ]);

  const herbs = herbsResult.success ? herbsResult.data!.herbs : [];
  const total = herbsResult.success ? herbsResult.data!.total : 0;
  const categories = categoriesResult.success ? categoriesResult.data! : [];
  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <Script
        id="herbs-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
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
          }),
        }}
      />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("herbs.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("herbs.subtitle")}
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <SmartSearch defaultValue={query} category={category} />
      </div>

      {/* Recently viewed */}
      {!query && !category && <RecentlyViewed />}

      {/* Daily Herb */}
      {!query && !category && (
        <div className="mb-6">
          <DailyHerbBanner />
        </div>
      )}

      {/* Categories */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Link href="/herbs">
          <Badge
            variant={!category ? "default" : "outline"}
            className="cursor-pointer"
          >
            {t("herbs.all")}
          </Badge>
        </Link>
        {categories
          .slice(0, 8)
          .map((cat: { slug: string; name: string }) => (
            <Link
              key={cat.slug}
              href={`/herbs?category=${cat.slug}${query ? `&q=${query}` : ""}`}
            >
              <Badge
                variant={category === cat.slug ? "default" : "outline"}
                className="cursor-pointer"
              >
                {cat.name}
              </Badge>
            </Link>
          ))}
      </div>

      {/* Results info */}
      {query && herbs.length > 0 && (
        <p className="mb-4 text-sm text-muted-foreground">
          {t("herbs.resultsFound", { count: total, query })}
        </p>
      )}

      {/* Grid */}
      {herbs.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {herbs.map((herb) => (
            <HerbCard key={herb.id} herb={herb} />
          ))}
        </div>
      ) : (
        <EmptyState
          variant="search"
          title={
            query ? t("herbs.noHerbsQuery", { query }) : t("herbs.noResults")
          }
          description={t("herbs.trySearching")}
          action={{ label: t("herbs.browseAll"), href: "/herbs" }}
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-4">
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
            {page} / {totalPages}
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
