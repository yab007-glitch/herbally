import type { MetadataRoute } from "next";

const FR_BASE = "/fr";
import { getAnonClient } from "@/lib/supabase/anonymous";
import { logger } from "@/lib/utils/logger";
import { SYMPTOM_SLUGS } from "@/app/(main)/symptoms/[symptom]/page";
import { POPULAR_COMPARISONS } from "@/app/(main)/compare/[slug1]/vs/[slug2]/page";
import { getInteractionPairs } from "@/lib/interactions/pairs";
import { pairPath } from "@/lib/interactions/pair-url";

// Snapshot of last modification time for static pages.
// Using a stable date prevents misleading Google into thinking
// static content changes every hour (sitemap revalidate = 3600). A module-top
// `new Date()` was re-evaluated on every hourly revalidation, bumping
// lastModified each time — Google re-crawled wastefully (M18, audit
// 2026-06-22). This is now a fixed literal; bump it deliberately when static
// page content actually changes.
const STATIC_PAGE_MODIFIED = new Date("2026-06-22T00:00:00Z");

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
    // Symptom detail pages — slugs come from the SAME source of truth as the
    // route's generateStaticParams (SYMPTOM_SLUGS), so the sitemap can never
    // emit a symptom URL the page doesn't serve (previously it listed
    // `blood-pressure`/`cough`, which 404'd: the real keys are the camelCase
    // `bloodPressure` and `cough` was never a symptom). Both locales emitted.
    ...SYMPTOM_SLUGS.flatMap((s) => [
      {
        url: `${baseUrl}/symptoms/${s}`,
        lastModified: STATIC_PAGE_MODIFIED,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      },
      {
        url: `${baseUrl}${FR_BASE}/symptoms/${s}`,
        lastModified: STATIC_PAGE_MODIFIED,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      },
    ]),
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
    // /herbalist now redirects to / (chat-first homepage)
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

  try {
    const supabase = getAnonClient();

    if (!supabase) {
      logger.error("sitemap_supabase_not_configured");
      return staticPages;
    }

    // Fetch all published herbs in batches (Supabase default limit = 1000).
    // FR URLs are only emitted when a French translation actually exists
    // (translations->'fr'). Emitting FR URLs for untranslated herbs creates
    // EN-content-on-FR-URL duplicates — Google then picks the EN URL as
    // canonical and reports "Alternative page with proper canonical tag"
    // (2,155 cases in Search Console, Sep 2026).
    const herbPages: MetadataRoute.Sitemap = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
      const { data: herbsBatch } = await supabase
        .from("herbs")
        .select("slug, updated_at, translations")
        .eq("is_published", true)
        .order("name", { ascending: true })
        .range(from, from + batchSize - 1);

      if (!herbsBatch || herbsBatch.length === 0) break;

      for (const herb of herbsBatch) {
        herbPages.push({
          url: `${baseUrl}/herbs/${herb.slug}`,
          lastModified: herb.updated_at
            ? new Date(herb.updated_at)
            : new Date(),
          changeFrequency: "weekly" as const,
          priority: 0.7,
        });
        const t = herb.translations as Record<string, unknown> | null;
        const hasFr = !!t && typeof t === "object" && "fr" in t && t.fr != null;
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
    const pairPages: MetadataRoute.Sitemap = (
      await getInteractionPairs()
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

    return [...staticPages, ...comparePages, ...pairPages, ...herbPages];
  } catch (error) {
    logger.error("sitemap_generation_error", {
      error: error instanceof Error ? error.message : String(error),
    });
    // Return static pages only on error
    return staticPages;
  }
}

// Revalidate every hour
export const revalidate = 3600;
