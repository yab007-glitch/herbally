import type { MetadataRoute } from "next";

const FR_BASE = "/fr";
import { getAnonClient } from "@/lib/supabase/anonymous";
import { execSync } from "node:child_process";
import { logger } from "@/lib/utils/logger";
import { SYMPTOM_SLUGS } from "@/lib/symptoms/symptom-meta";
import { getEmptySymptomHubs } from "@/lib/symptoms/hub-coverage";
import { POPULAR_COMPARISONS } from "@/app/[locale]/(main)/compare/[slug1]/vs/[slug2]/page";
import { getInteractionPairs } from "@/lib/interactions/pairs";
import { pairPath } from "@/lib/interactions/pair-url";
import { withTimeout } from "@/lib/utils/with-timeout";
import { publishedGuides } from "@/lib/guides/guides";

// Snapshot of last modification time for static pages.
// Using a stable date prevents misleading Google into thinking
// static content changes every hour (sitemap revalidate = 3600). A module-top
// `new Date()` was re-evaluated on every hourly revalidation, bumping
// lastModified each time — Google re-crawled wastefully (M18, audit
// 2026-06-22). This is now a fixed literal; bump it deliberately when static
// page content actually changes.
// Static marketing pages change when the repo changes, not on a fixed date. A
// hard-coded value shipped 2026-06-22 as the lastmod for the homepage, /herbs
// and every hub on every deploy for five months — a sitemap that never updates
// is one Google learns to ignore.
const FALLBACK_STATIC_MODIFIED = new Date("2026-11-02T00:00:00Z");

function staticPageModified(): Date {
  // Vercel sets this per deployment (unix seconds).
  const fromEnv = process.env.VERCEL_GIT_COMMIT_TIMESTAMP;
  if (fromEnv) {
    const ms = Number(fromEnv) * 1000;
    if (Number.isFinite(ms) && ms > 0) return new Date(ms);
  }
  try {
    // `stdio: ignore` on stderr: a build sandbox without git must not spray
    // "not a git repository" into the build log before falling back.
    const iso = execSync("git log -1 --format=%cI", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  } catch {
    // No git in the build sandbox — fall through.
  }
  return FALLBACK_STATIC_MODIFIED;
}

const STATIC_PAGE_MODIFIED = staticPageModified();

// New static pages get their own timestamp so adding them does not bump the
// lastModified of every unrelated marketing page.
const SPONSORSHIP_PAGE_MODIFIED = new Date("2026-10-28T00:00:00Z");

/**
 * Rows per herb query. The herb row carries a large `translations` jsonb; 1,000
 * rows in one response is several megabytes and times out under load, which used
 * to cost the sitemap every herb URL. 500 still finishes the whole library in
 * six requests on a healthy database.
 */
const HERB_BATCH_SIZE = 500;

type HerbSitemapRow = {
  slug: string;
  updated_at: string | null;
  translations: unknown;
};

/**
 * One herb batch, or null when the query failed.
 *
 * `error` must be handled explicitly: PostgREST answers a statement timeout with
 * `{ data: null, error: { code: "57014" } }`, and the previous code only read
 * `data`, so the failure looked exactly like "no more rows".
 */
async function fetchHerbBatch(
  supabase: NonNullable<ReturnType<typeof getAnonClient>>,
  from: number,
  size: number,
  timeoutMs: number
): Promise<HerbSitemapRow[] | null> {
  try {
    const { data, error } = await withTimeout(
      supabase
        .from("herbs")
        .select("slug, updated_at, translations")
        .eq("is_published", true)
        .order("slug", { ascending: true })
        .range(from, from + size - 1),
      "sitemap_herbs_batch",
      timeoutMs
    );
    if (error) {
      logger.error("sitemap_herbs_query_error", {
        error: error.message,
        code: error.code,
        from,
        size,
      });
      return null;
    }
    return (data ?? []) as HerbSitemapRow[];
  } catch (error) {
    logger.error("sitemap_herbs_query_failed", {
      error: error instanceof Error ? error.message : String(error),
      from,
      size,
    });
    return null;
  }
}

/**
 * EN + FR entry for each symptom hub slug.
 *
 * Also used by the degraded path: before these were split out of `staticPages`,
 * a database failure still listed every hub because they were unconditional. If
 * the herb query dies, the caller passes all slugs back in — the sitemap should
 * never shrink itself just because Supabase was unreachable.
 */
function symptomPagesFor(
  slugs: string[],
  baseUrl: string
): MetadataRoute.Sitemap {
  return slugs.flatMap((slug) => [
    {
      url: `${baseUrl}/symptoms/${slug}`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}${FR_BASE}/symptoms/${slug}`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
  ]);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app";

  // Static pages — every English page has a French counterpart at /fr/*.
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}${FR_BASE}`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/herbs`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}${FR_BASE}/herbs`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/symptoms`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}${FR_BASE}/symptoms`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    // Hub for the 22 herb-vs-herb comparisons. It was missing entirely while
    // the /compare/a/vs/b pages sat in this sitemap as orphans — a 404 at the
    // parent meant the cluster had no crawl entry point.
    {
      url: `${baseUrl}/compare`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}${FR_BASE}/compare`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}${FR_BASE}/faq`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/calculator`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}${FR_BASE}/calculator`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    // Core tools and E-E-A-T policy/contact pages
    {
      url: `${baseUrl}/herbalist`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}${FR_BASE}/herbalist`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/editorial-policy`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}${FR_BASE}/editorial-policy`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}${FR_BASE}/contact`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}${FR_BASE}/about`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/donate`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}${FR_BASE}/donate`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/methodology`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}${FR_BASE}/methodology`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/sponsors`,
      lastModified: SPONSORSHIP_PAGE_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}${FR_BASE}/sponsors`,
      lastModified: SPONSORSHIP_PAGE_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    // Guides hub: indexable. Individual guides are added below only once they
    // are published — a draft is `noindex`, so listing it here would be a lie.
    {
      url: `${baseUrl}/guides`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}${FR_BASE}/guides`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    ...publishedGuides().flatMap((guide) => [
      {
        url: `${baseUrl}/guides/${guide.slug}`,
        lastModified: new Date(`${guide.updated}T00:00:00Z`),
        changeFrequency: "monthly" as const,
        priority: 0.6,
      },
      {
        url: `${baseUrl}${FR_BASE}/guides/${guide.slug}`,
        lastModified: new Date(`${guide.updated}T00:00:00Z`),
        changeFrequency: "monthly" as const,
        priority: 0.6,
      },
    ]),
    {
      url: `${baseUrl}/herb-drug-interactions`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}${FR_BASE}/herb-drug-interactions`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/disclaimer`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}${FR_BASE}/disclaimer`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}${FR_BASE}/privacy`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}${FR_BASE}/terms`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  // One total database budget for the whole route. Next prerenders this file
  // with a 60s ceiling; a slow or unreachable Supabase must degrade to the
  // static list, never run past that ceiling and fail the entire build.
  // `next build` sets NEXT_PHASE, and a one-off build can afford more time
  // than an on-demand ISR revalidation. The runtime budget is deliberately
  // generous: three herb batches plus one pair query take a few seconds on a
  // healthy database, and cutting them off early would cache a sitemap with
  // every herb URL missing for an hour — a silent SEO loss that costs more
  // than a slow response. Computed per invocation, not at module scope, so
  // tests and the build phase see their own value.
  const dbBudgetMs =
    process.env.NEXT_PHASE === "phase-production-build" ? 40_000 : 20_000;
  const deadline = Date.now() + dbBudgetMs;
  const remainingBudgetMs = () => deadline - Date.now();
  // Degraded paths list every symptom hub: nothing here can tell which hubs are
  // empty, and losing 52 live URLs because a query timed out is worse than
  // listing a thin page. Only the healthy path filters them.
  const degradedPages = () => [
    ...staticPages,
    ...symptomPagesFor(SYMPTOM_SLUGS, baseUrl),
  ];
  const budgetExhausted = () => {
    logger.error("sitemap_generation_error", {
      error: `sitemap database budget of ${dbBudgetMs}ms exhausted`,
    });
    return degradedPages();
  };

  try {
    const supabase = getAnonClient();

    if (!supabase) {
      logger.error("sitemap_supabase_not_configured");
      return degradedPages();
    }

    // Fetch all published herbs in batches (Supabase default limit = 1000).
    // FR URLs are only emitted when a French translation actually exists
    // (translations->'fr'). Emitting FR URLs for untranslated herbs creates
    // EN-content-on-FR-URL duplicates — Google then picks the EN URL as
    // canonical and reports "Alternative page with proper canonical tag"
    // (2,155 cases in Search Console, Sep 2026).
    //
    // 2026-11-02: a single batch that hit the database's statement timeout
    // (57014, ~5s under load) made this loop `break` on the first iteration and
    // served a *static-only* sitemap — 478 URLs instead of 5,876 — for the whole
    // hour-long cache window, with a 200 status. Ordering by `name` also forces
    // a full sort on every batch; `slug` is unique and indexed. Both fixed here,
    // plus a retry at a quarter of the batch size before giving up.
    const herbPages: MetadataRoute.Sitemap = [];
    // Symptom hubs are emitted only for symptoms that actually match a
    // published herb. Four of them (bloodPressure, hormonal, prostate,
    // diabetes) match nothing, so they were indexable pages whose whole body
    // was "no herbs found yet" — the soft-404 shape.
    let from = 0;
    let batchSize = HERB_BATCH_SIZE;
    while (true) {
      const herbsRemainingMs = remainingBudgetMs();
      if (herbsRemainingMs <= 0) return budgetExhausted();

      let herbsBatch: Awaited<ReturnType<typeof fetchHerbBatch>> | null = null;
      for (const size of [batchSize, Math.max(50, Math.floor(batchSize / 4))]) {
        const remaining = remainingBudgetMs();
        if (remaining <= 0) break;
        herbsBatch = await fetchHerbBatch(supabase, from, size, remaining);
        if (herbsBatch) {
          batchSize = size;
          break;
        }
        logger.error("sitemap_herbs_batch_retry", { from, size });
      }

      if (!herbsBatch) {
        // Do not pretend the sitemap is complete: keep whatever was collected
        // and let the pair/static pages through, but record the loss loudly.
        logger.error("sitemap_herbs_incomplete", {
          from,
          collected: herbPages.length,
        });
        break;
      }

      if (herbsBatch.length === 0) break;

      for (const herb of herbsBatch) {
        herbPages.push({
          url: `${baseUrl}/herbs/${herb.slug}`,
          lastModified: herb.updated_at
            ? new Date(herb.updated_at)
            : new Date(),
          changeFrequency: "weekly" as const,
          priority: 0.7,
        });
        // Only list a French URL when the herb actually has a French record.
        // /fr/herbs/<slug> resolves for every slug, but without `translations.fr`
        // it renders French chrome around English content — listing that as the
        // French page is how a site gets a section treated as duplicate content.
        const t = herb.translations as Record<string, unknown> | null;
        const frRecord =
          t && typeof t === "object" ? (t as { fr?: unknown }).fr : null;
        const hasFr =
          !!frRecord &&
          typeof frRecord === "object" &&
          Object.keys(frRecord).length > 0;
        if (hasFr) {
          herbPages.push({
            url: `${baseUrl}${FR_BASE}/herbs/${herb.slug}`,
            lastModified: herb.updated_at
              ? new Date(herb.updated_at)
              : new Date(),
            changeFrequency: "weekly" as const,
            priority: 0.7,
          });
        }
      }

      if (herbsBatch.length < batchSize) break;
      from += batchSize;
    }

    // Symptom hubs — every slug the route serves (SYMPTOM_SLUGS), but only
    // the ones with matching published herbs. If the herb query failed
    // outright, fail open and list them all: dropping real URLs from the
    // sitemap is worse than listing a thin one.
    // One shared column read (memoised in hub-coverage), not a per-row scan of
    // the herb batches: selecting `symptom_keywords` alongside 2,700 rows made
    // this query time out at 40s during the build.
    const emptyHubs = await getEmptySymptomHubs();
    if (emptyHubs.length > 0) {
      // warn, not error: an empty hub is a content gap, not a runtime failure,
      // and this runs on every hourly revalidation.
      logger.warn("sitemap_symptom_hubs_empty", { omitted: emptyHubs });
    }
    const symptomSlugs = SYMPTOM_SLUGS.filter(
      (slug) => !emptyHubs.includes(slug)
    );
    const symptomPages = symptomPagesFor(symptomSlugs, baseUrl);

    // Compare pages — pairs come from the SAME source of truth as the
    // compare route's generateStaticParams (POPULAR_COMPARISONS). Both locales.
    const comparePages: MetadataRoute.Sitemap = POPULAR_COMPARISONS.flatMap(
      ({ slug1, slug2 }) => [
        {
          url: `${baseUrl}/compare/${slug1}/vs/${slug2}`,
          lastModified: STATIC_PAGE_MODIFIED,
          changeFrequency: "monthly" as const,
          priority: 0.6,
        },
        {
          url: `${baseUrl}${FR_BASE}/compare/${slug1}/vs/${slug2}`,
          lastModified: STATIC_PAGE_MODIFIED,
          changeFrequency: "monthly" as const,
          priority: 0.6,
        },
      ]
    );

    // NOTE: /herbs?category=* and /herbs?page=* / ?q=* faceted/search URLs are
    // intentionally NOT in the sitemap. They canonicalize to /herbs (see
    // buildPageMetadata path="/herbs"), so listing them here only creates
    // "Alternative page with proper canonical tag" exclusions in Search
    // Console. Let Google discover facets via internal links, not the sitemap.

    // Herb↔drug pair pages — every curated interaction gets an indexable
    // permalink. FR URLs only when the row actually has a French translation
    // (same gating rule as herbs: EN-content-on-FR-URL duplicates get
    // canonicalized away by Google).
    const pairsRemainingMs = remainingBudgetMs();
    if (pairsRemainingMs <= 0) return budgetExhausted();

    const pairPages: MetadataRoute.Sitemap = (
      await withTimeout(
        getInteractionPairs(),
        "sitemap_interaction_pairs",
        pairsRemainingMs
      )
    ).flatMap((p) => {
      const path = pairPath(p.herbSlug, p.drugName);
      const entries: MetadataRoute.Sitemap = [
        {
          url: `${baseUrl}${path}`,
          lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
          changeFrequency: "monthly" as const,
          priority: 0.8,
        },
      ];
      if (p.hasFr) {
        entries.push({
          url: `${baseUrl}${FR_BASE}${path}`,
          lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
          changeFrequency: "monthly" as const,
          priority: 0.8,
        });
      }
      return entries;
    });

    return [
      ...staticPages,
      ...symptomPages,
      ...comparePages,
      ...pairPages,
      ...herbPages,
    ];
  } catch (error) {
    logger.error("sitemap_generation_error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return degradedPages();
  }
}

// Revalidate every hour
export const revalidate = 3600;
