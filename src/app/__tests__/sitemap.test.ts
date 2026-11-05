import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sitemap from "../sitemap";
import { SYMPTOM_SLUGS } from "@/lib/symptoms/symptom-meta";

const getEmptySymptomHubsMock = vi.fn();
vi.mock("@/lib/symptoms/hub-coverage", () => ({
  getEmptySymptomHubs: () => getEmptySymptomHubsMock(),
}));

const rangeMock = vi.fn();
const fromMock = vi.fn();
const getInteractionPairsMock = vi.fn();

vi.mock("@/lib/supabase/anonymous", () => ({
  getAnonClient: () => ({ from: fromMock }),
}));

vi.mock("@/lib/interactions/pairs", () => ({
  getInteractionPairs: () => getInteractionPairsMock(),
}));

// The route borrows the compare list from its page module, which pulls in
// next-intl/server -> next/root-params, a compiler-only placeholder that cannot
// be imported under Vitest. The sitemap only needs the exported list, so stub
// it. Symptom slugs now come from src/lib/symptoms/symptom-meta, a plain
// module, so they are imported for real.

vi.mock("@/app/[locale]/(main)/compare/[slug1]/vs/[slug2]/page", () => ({
  POPULAR_COMPARISONS: [{ slug1: "turmeric", slug2: "ginger" }],
}));

const BASE_URL = "https://herbally.test";

// A hub whose keyword no fixture herb carries, so "listed only when populated"
// can be asserted as a pair.
const UNPOPULATED_HUB = SYMPTOM_SLUGS.find((slug) => slug !== "anxiety")!;

describe("sitemap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = BASE_URL;
    delete process.env.NEXT_PHASE;

    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => ({
            range: rangeMock,
          }),
        }),
      }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("returns herb and interaction-pair URLs from a healthy database", async () => {
    rangeMock.mockResolvedValue({
      data: [
        {
          slug: "ginger",
          updated_at: "2026-01-02T00:00:00.000Z",
          translations: { fr: { name: "Gingembre" } },
          symptom_keywords: ["anxiety"],
        },
        {
          slug: "turmeric",
          updated_at: null,
          translations: null,
          symptom_keywords: null,
        },
      ],
      error: null,
    });
    getEmptySymptomHubsMock.mockResolvedValue([UNPOPULATED_HUB]);
    getInteractionPairsMock.mockResolvedValue([
      {
        id: "p1",
        herbSlug: "ginger",
        herbName: "Ginger",
        herbScientificName: "Zingiber officinale",
        drugName: "Warfarin (Coumadin)",
        drugSlug: "warfarin",
        severity: "moderate",
        description: "May increase bleeding risk.",
        mechanism: null,
        evidenceLevel: "B",
        source: null,
        sourceUrl: null,
        updatedAt: "2026-02-03T00:00:00.000Z",
        hasFr: true,
      },
    ]);

    const result = await sitemap();
    const urls = result.map((entry) => entry.url);

    // A French URL is listed only when the herb has a French record: the /fr route
    // resolves for every slug, but without translations.fr it is English content
    // under a French shell, which is duplicate content rather than a translation.
    expect(urls).toContain(`${BASE_URL}/herbs/ginger`);
    expect(urls).toContain(`${BASE_URL}/fr/herbs/ginger`);
    expect(urls).toContain(`${BASE_URL}/herbs/turmeric`);
    expect(urls).not.toContain(`${BASE_URL}/fr/herbs/turmeric`);

    // Pair URLs, both locales (hasFr = true).
    expect(urls).toContain(`${BASE_URL}/interactions/ginger/warfarin`);
    expect(urls).toContain(`${BASE_URL}/fr/interactions/ginger/warfarin`);

    // A hub is emitted unless the coverage read says nothing carries it.
    expect(urls).toContain(`${BASE_URL}/symptoms/anxiety`);
    expect(urls).toContain(`${BASE_URL}/fr/symptoms/anxiety`);
    expect(urls).not.toContain(`${BASE_URL}/symptoms/${UNPOPULATED_HUB}`);

    // Static pages still lead, and herbs remain last (output order unchanged).
    expect(urls[0]).toBe(BASE_URL);
    expect(urls.slice(-3)).toEqual([
      `${BASE_URL}/herbs/ginger`,
      `${BASE_URL}/fr/herbs/ginger`,
      `${BASE_URL}/herbs/turmeric`,
    ]);
  });

  it("stamps static pages with a build date, not a frozen one", async () => {
    rangeMock.mockResolvedValue({ data: [], error: null });
    getEmptySymptomHubsMock.mockResolvedValue([]);
    getInteractionPairsMock.mockResolvedValue([]);

    const result = await sitemap();
    const home = result.find((entry) => entry.url === BASE_URL);

    // This shipped 2026-06-22 as the lastmod for every static page for five
    // months. Anything older than the last real content change is a lie.
    expect(home?.lastModified).toBeInstanceOf(Date);
    expect(new Date(home!.lastModified as Date).getTime()).toBeGreaterThan(
      new Date("2026-11-01T00:00:00Z").getTime()
    );
  });

  it("returns only static pages when a query never settles", async () => {
    vi.useFakeTimers();
    rangeMock.mockReturnValue(new Promise(() => {}));
    getEmptySymptomHubsMock.mockResolvedValue([]);
    getInteractionPairsMock.mockResolvedValue([]);

    const pending = sitemap();
    // The non-build budget is 20s; the hanging query must be abandoned by then.
    await vi.advanceTimersByTimeAsync(20_000);
    const result = await pending;
    const urls = result.map((entry) => entry.url);

    // No partial herb list, and the pair query never ran.
    expect(urls.every((url) => !url.includes("/herbs/"))).toBe(true);
    expect(urls).toContain(`${BASE_URL}/herbs`);
    expect(urls).toContain(BASE_URL);
    expect(getInteractionPairsMock).not.toHaveBeenCalled();

    // Fail open: with no herb rows to check against, every hub stays listed.
    // Dropping real URLs from a sitemap is worse than listing a thin page.
    expect(urls).toContain(`${BASE_URL}/symptoms/${UNPOPULATED_HUB}`);
  });
});
