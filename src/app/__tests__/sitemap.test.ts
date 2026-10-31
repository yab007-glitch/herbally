import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sitemap from "../sitemap";

const rangeMock = vi.fn();
const fromMock = vi.fn();
const getInteractionPairsMock = vi.fn();

vi.mock("@/lib/supabase/anonymous", () => ({
  getAnonClient: () => ({ from: fromMock }),
}));

vi.mock("@/lib/interactions/pairs", () => ({
  getInteractionPairs: () => getInteractionPairsMock(),
}));

// The route borrows these lists from the symptom/compare page modules. Those
// pages pull in next-intl/server -> next/root-params, a compiler-only
// placeholder that cannot be imported under Vitest. The sitemap only needs
// the exported lists, so stub them.
vi.mock("@/app/[locale]/(main)/symptoms/[symptom]/page", () => ({
  SYMPTOM_SLUGS: ["anxiety"],
}));

vi.mock("@/app/[locale]/(main)/compare/[slug1]/vs/[slug2]/page", () => ({
  POPULAR_COMPARISONS: [{ slug1: "turmeric", slug2: "ginger" }],
}));

const BASE_URL = "https://herbally.test";

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
        },
        {
          slug: "turmeric",
          updated_at: null,
          translations: null,
        },
      ],
      error: null,
    });
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

    // Healthy behaviour is unchanged: translated herbs get a FR URL, the
    // untranslated one does not.
    expect(urls).toContain(`${BASE_URL}/herbs/ginger`);
    expect(urls).toContain(`${BASE_URL}/fr/herbs/ginger`);
    expect(urls).toContain(`${BASE_URL}/herbs/turmeric`);
    expect(urls).not.toContain(`${BASE_URL}/fr/herbs/turmeric`);

    // Pair URLs, both locales (hasFr = true).
    expect(urls).toContain(`${BASE_URL}/interactions/ginger/warfarin`);
    expect(urls).toContain(`${BASE_URL}/fr/interactions/ginger/warfarin`);

    // Static pages still lead, and herbs remain last (output order unchanged).
    expect(urls[0]).toBe(BASE_URL);
    expect(urls.slice(-3)).toEqual([
      `${BASE_URL}/herbs/ginger`,
      `${BASE_URL}/fr/herbs/ginger`,
      `${BASE_URL}/herbs/turmeric`,
    ]);
  });

  it("returns only static pages when a query never settles", async () => {
    vi.useFakeTimers();
    rangeMock.mockReturnValue(new Promise(() => {}));
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
  });
});
