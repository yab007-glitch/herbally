import { beforeEach, describe, expect, it, vi } from "vitest";

const { localeState } = vi.hoisted(() => ({
  localeState: { value: "en" as "en" | "fr" },
}));

vi.mock("./page-locale", () => ({
  getLocale: async () => localeState.value,
}));

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => `t:${key}`,
}));

import { BASE_URL, buildPageMetadata } from "./metadata";

type OgImage = { url: string };

describe("buildPageMetadata", () => {
  beforeEach(() => {
    localeState.value = "en";
  });

  it("adds the social image and locale for English", async () => {
    const result = await buildPageMetadata({
      titleKey: "herbsDatabase",
      path: "/herbs",
    });

    const images = result.openGraph?.images as OgImage[];
    expect(images[0].url.endsWith("/opengraph-image")).toBe(true);
    expect(result.openGraph?.locale).toBe("en_US");
    expect(result.alternates?.canonical).toBe(`${BASE_URL}/herbs`);
  });

  it("adds the French locale and prefixed canonical", async () => {
    localeState.value = "fr";

    const result = await buildPageMetadata({
      titleKey: "herbsDatabase",
      path: "/herbs",
    });

    const images = result.openGraph?.images as OgImage[];
    expect(images[0].url.endsWith("/opengraph-image")).toBe(true);
    expect(result.openGraph?.locale).toBe("fr_FR");
    expect(result.alternates?.canonical).toBe(`${BASE_URL}/fr/herbs`);
  });

  it("keeps og:image and og:locale when a page passes its own openGraph", async () => {
    const result = await buildPageMetadata({
      titleKey: "herbsDatabase",
      path: "/herbs",
      openGraph: {
        title: "Custom OG title",
        description: "Custom OG description",
        alternateLocale: ["fr_FR"],
      },
    });

    const images = result.openGraph?.images as OgImage[];
    expect(result.openGraph?.title).toBe("Custom OG title");
    expect(result.openGraph?.description).toBe("Custom OG description");
    expect(images[0].url.endsWith("/opengraph-image")).toBe(true);
    expect(result.openGraph?.locale).toBe("en_US");
    expect(result.openGraph?.alternateLocale).toEqual(["fr_FR"]);
  });

  it("lets a page replace the shared image only by overriding it explicitly", async () => {
    const result = await buildPageMetadata({
      titleKey: "herbsDatabase",
      path: "/herbs",
      openGraph: { images: ["/custom-og.png"] },
    });

    expect(result.openGraph?.images).toEqual(["/custom-og.png"]);
    expect(result.openGraph?.locale).toBe("en_US");
  });
});
