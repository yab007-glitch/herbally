import type { MetadataRoute } from "next";

const FR_BASE = "/fr";
import { getAnonClient } from "@/lib/supabase/anonymous";
import { logger } from "@/lib/utils/logger";

// Snapshot of last modification time for static pages.
// Using a stable date prevents misleading Google into thinking
// static content changes every hour (sitemap revalidate = 3600).
const STATIC_PAGE_MODIFIED = new Date();

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app";

  // Static pages
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
    ...[
      "anxiety",
      "sleep",
      "inflammation",
      "digestion",
      "blood-pressure",
      "immune",
      "headache",
      "liver",
      "skin",
      "menstrual",
      "menopause",
      "cold",
      "joint",
      "diabetes",
      "cholesterol",
      "depression",
      "focus",
      "nausea",
      "constipation",
      "nerve",
      "circulation",
      "allergy",
      "cough",
      "wound",
      "acne",
      "hormonal",
    ].map((s) => ({
      url: `${baseUrl}/symptoms/${s}`,
      lastModified: STATIC_PAGE_MODIFIED,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
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
      url: `${baseUrl}/disclaimer`,
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
      url: `${baseUrl}/terms`,
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

    // Fetch all published herbs in batches (Supabase default limit = 1000)
    const herbPages: MetadataRoute.Sitemap = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
      const { data: herbsBatch } = await supabase
        .from("herbs")
        .select("slug, updated_at")
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
        herbPages.push({
          url: `${baseUrl}${FR_BASE}/herbs/${herb.slug}`,
          lastModified: herb.updated_at
            ? new Date(herb.updated_at)
            : new Date(),
          changeFrequency: "weekly" as const,
          priority: 0.7,
        });
      }

      if (herbsBatch.length < batchSize) break;
      from += batchSize;
    }

    // Get categories for category pages
    const { data: categories } = await supabase
      .from("herb_categories")
      .select("slug");

    const comparePages: MetadataRoute.Sitemap = [
      {
        url: `${baseUrl}/compare/turmeric/vs/ginger`,
        lastModified: STATIC_PAGE_MODIFIED,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      },
      {
        url: `${baseUrl}/compare/ashwagandha/vs/rhodiola`,
        lastModified: STATIC_PAGE_MODIFIED,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      },
      {
        url: `${baseUrl}/compare/chamomile/vs/valerian`,
        lastModified: STATIC_PAGE_MODIFIED,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      },
      {
        url: `${baseUrl}/compare/garlic/vs/ginger`,
        lastModified: STATIC_PAGE_MODIFIED,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      },
      {
        url: `${baseUrl}/compare/echinacea/vs/elderberry`,
        lastModified: STATIC_PAGE_MODIFIED,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      },
      {
        url: `${baseUrl}/compare/ginkgo/vs/ginseng`,
        lastModified: STATIC_PAGE_MODIFIED,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      },
      {
        url: `${baseUrl}/compare/lavender/vs/chamomile`,
        lastModified: STATIC_PAGE_MODIFIED,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      },
      {
        url: `${baseUrl}/compare/turmeric/vs/ashwagandha`,
        lastModified: STATIC_PAGE_MODIFIED,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      },
      {
        url: `${baseUrl}/compare/st-johns-wort/vs/kava`,
        lastModified: STATIC_PAGE_MODIFIED,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      },
      {
        url: `${baseUrl}/compare/milk-thistle/vs/dandelion`,
        lastModified: STATIC_PAGE_MODIFIED,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      },
    ];

    const categoryPages: MetadataRoute.Sitemap = [];
    for (const cat of categories ?? []) {
      categoryPages.push({
        url: `${baseUrl}/herbs?category=${cat.slug}`,
        lastModified: STATIC_PAGE_MODIFIED,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      });
      categoryPages.push({
        url: `${baseUrl}${FR_BASE}/herbs?category=${cat.slug}`,
        lastModified: STATIC_PAGE_MODIFIED,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      });
    }

    return [...staticPages, ...comparePages, ...categoryPages, ...herbPages];
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
