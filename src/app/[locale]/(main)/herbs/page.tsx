import { buildPageMetadata } from "@/lib/i18n/metadata";
import { Suspense } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { HerbCard } from "@/components/herbs/herb-card";
import { HerbPagination } from "@/components/herbs/herb-pagination";
import { buildHerbListUrl } from "@/lib/search/herb-list-url";
import { SmartSearch } from "@/components/herbs/smart-search";
import { EmptyState } from "@/components/shared/empty-state";
import { DailyHerbBanner } from "@/components/herbs/daily-herb-banner";
import { RecentlyViewed } from "@/components/herbs/recently-viewed";
import { getHerbs, getHerbCategories } from "@/lib/actions/herbs";
import { siteUrl } from "@/lib/seo/site-url";
import { getTranslations } from "next-intl/server";
import { getLocale } from "@/lib/i18n/page-locale";
import { redirect } from "next/navigation";
import Script from "next/script";

export const generateMetadata = () =>
  buildPageMetadata({
    titleKey: "herbsDatabase",
    descKey: "herbsDatabaseDesc",
    path: "/herbs",
  });

export default async function HerbsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    page?: string;
    sort?: string;
  }>;
}) {
  const params = await searchParams;
  const query = params.q || "";
  const category = params.category || "";
  // Sort: only "evidence" is a non-default value. Anything else (including
  // an explicit ?sort=name, which the canonical URL drops) redirects below.
  const sort = params.sort === "evidence" ? "evidence" : "name";
  // Sanitize ?page=: non-integers, negatives, and 0 collapse to 1. Anything
  // non-canonical (including ?page=1, which duplicates the base URL) is
  // redirected below so junk/stale pagination URLs never render or index.
  const parsedPage =
    params.page === undefined ? 1 : Math.floor(Number(params.page));
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
  const locale = await getLocale();
  const t = await getTranslations({ locale });
  const [herbsResult, categoriesResult] = await Promise.all([
    getHerbs({ query, category, page, sort }, locale),
    getHerbCategories(locale),
  ]);

  const categories = categoriesResult.success ? categoriesResult.data! : [];
  const buildCanonical = (opts: {
    dropPage?: boolean;
    dropCategory?: boolean;
    dropSort?: boolean;
  }) => {
    return buildHerbListUrl({
      q: query || undefined,
      category: category && !opts.dropCategory ? category : undefined,
      sort: sort === "evidence" && !opts.dropSort ? sort : undefined,
      page: !opts.dropPage ? page : undefined,
      anchor: null,
    });
  };

  // Unknown ?category= previously rendered the UNFILTERED list with no hint
  // (looked like the filter was broken). Redirect to the canonical URL
  // instead — but only when we actually loaded the category list, so a
  // failed categories fetch can't cause a redirect loop.
  if (
    category &&
    categoriesResult.success &&
    !categories.some((c: { slug: string }) => c.slug === category)
  ) {
    redirect(buildCanonical({ dropPage: true, dropCategory: true }));
  }

  const herbs = herbsResult.success ? herbsResult.data!.herbs : [];
  const total = herbsResult.success ? herbsResult.data!.total : 0;
  const totalPages = Math.ceil(total / 20);

  // If the listing query itself failed on a paginated URL (e.g. PostgREST
  // "range not satisfiable" for ?page=999999 collapses total to 0, which
  // would otherwise skip the out-of-range check below), fall back to the
  // canonical first page instead of a dead empty state.
  if (!herbsResult.success && page > 1) {
    redirect(buildCanonical({ dropPage: true }));
  }

  // Out-of-range or non-canonical ?page= (?page=0, ?page=1, ?page=999999)
  // previously rendered "No herbs found" with no pagination — a dead end for
  // stale bookmarks. Redirect to the canonical URL instead.
  const pageParam = params.page;
  const pageIsCanonical =
    (pageParam === undefined && page === 1) || pageParam === String(page);
  const sortParam = params.sort;
  const sortIsCanonical = sortParam === undefined || sortParam === "evidence";
  if (
    !pageIsCanonical ||
    !sortIsCanonical ||
    (totalPages > 0 && page > totalPages)
  ) {
    redirect(
      buildCanonical({
        dropPage: totalPages > 0 && page > totalPages ? true : page === 1,
        dropSort: !sortIsCanonical,
      })
    );
  }

  const activeCategoryName = categories.find(
    (c: { slug: string; name: string }) => c.slug === category
  )?.name;

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
                url: `${siteUrl()}/herbs/${herb.slug || ""}`,
              },
            })),
          }).replace(/</g, "\\u003c"),
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

      {/* Search. SmartSearch reads `useSearchParams()`, which needs an ancestor
          Suspense boundary during prerendering. The boundary used to come from
          the (main) loading.tsx; that file is gone so unknown slugs can return a
          real 404 instead of a 200 soft 404 (a streamed shell cannot change
          status). Keep the requirement satisfied locally. */}
      <div className="mb-6">
        <Suspense fallback={null}>
          <SmartSearch defaultValue={query} category={category} sort={sort} />
        </Suspense>
      </div>

      {/* Recently viewed */}
      {!query && !category && <RecentlyViewed />}

      {/* Daily Herb */}
      {!query && !category && (
        <div className="mb-6">
          <DailyHerbBanner />
        </div>
      )}

      {/* Categories — search AND category combine: a category pill keeps
          the current search (and sort) and only resets the page. */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href={buildHerbListUrl({
            q: query || undefined,
            sort: sort === "evidence" ? sort : undefined,
            anchor: null,
          })}
        >
          <Badge
            variant={!category ? "default" : "outline"}
            className="cursor-pointer"
          >
            {t("herbs.all")}
          </Badge>
        </Link>
        {categories.slice(0, 8).map((cat: { slug: string; name: string }) => (
          <Link
            key={cat.slug}
            href={buildHerbListUrl({
              q: query || undefined,
              category: cat.slug,
              sort: sort === "evidence" ? sort : undefined,
              anchor: null,
            })}
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

      {/* Sort — the data already supports both keys: name (default) and
          evidence level (used for keyword matches). No other sort is offered. */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {t("herbs.sortLabel")}:
        </span>
        <Link
          href={buildHerbListUrl({
            q: query || undefined,
            category: category || undefined,
            anchor: null,
          })}
        >
          <Badge
            variant={sort === "name" ? "default" : "outline"}
            className="cursor-pointer"
          >
            {t("herbs.sortName")}
          </Badge>
        </Link>
        <Link
          href={buildHerbListUrl({
            q: query || undefined,
            category: category || undefined,
            sort: "evidence",
            anchor: null,
          })}
        >
          <Badge
            variant={sort === "evidence" ? "default" : "outline"}
            className="cursor-pointer"
          >
            {t("herbs.sortEvidence")}
          </Badge>
        </Link>
      </div>

      {/* Results info — the total is the count for the current
          search+category+sort combination, not the whole database. */}
      {(query || category || sort === "evidence") && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {herbs.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {query
                ? t("herbs.resultsFound", { count: total, query })
                : activeCategoryName
                  ? t("herbs.resultsInCategory", {
                      count: total,
                      category: activeCategoryName,
                    })
                  : t("herbs.results", { count: total })}
            </p>
          )}
          <Link href="/herbs" className="text-sm text-primary hover:underline">
            {t("herbs.clearAll")}
          </Link>
        </div>
      )}

      {/* A failed listing query must never look like "no results": show
          the failure explicitly instead of the empty state. (Page > 1
          failures already redirect to page 1 above.) */}
      {!herbsResult.success && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-foreground"
        >
          {t("herbs.loadError")}
        </div>
      )}

      {/* Grid — id is the pagination scroll target. */}
      <div id="herb-results" className="scroll-mt-24">
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
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <HerbPagination
          page={page}
          totalPages={totalPages}
          query={query}
          category={category}
          sort={sort}
        />
      )}
    </div>
  );
}
