import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

const getInteractionPairMock = vi.fn();
const getRelatedPairsMock = vi.fn();
const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));

vi.mock("@/lib/i18n/page-locale", () => ({
  getLocale: async () => "en",
}));

vi.mock("@/lib/interactions/pairs", () => ({
  getInteractionPair: (herb: string, drug: string, locale: string) =>
    getInteractionPairMock(herb, drug, locale),
  getInteractionPairs: async () => [],
  getRelatedPairs: (pair: unknown, locale: string) =>
    getRelatedPairsMock(pair, locale),
}));

vi.mock("@/components/i18n/localized-link", () => ({
  LocalizedLink: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/shared/breadcrumbs", () => ({
  Breadcrumbs: () => null,
}));
vi.mock("@/components/seo/webpage-schema", () => ({
  WebPageSchema: () => null,
}));
vi.mock("@/components/seo/breadcrumb-list-schema", () => ({
  BreadcrumbListSchema: () => null,
}));
vi.mock("@/components/seo/faq-schema", () => ({
  FAQSchema: () => null,
}));

import InteractionPairPage, { generateMetadata } from "../page";
import {
  InteractionDataUnavailableError,
  InteractionUrlCollisionError,
} from "@/lib/interactions/errors";

describe("InteractionPairPage availability & collision fail-safe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://api.herbally.app";
    getRelatedPairsMock.mockResolvedValue({ sameHerb: [], sameDrug: [] });
  });

  it("propagates InteractionDataUnavailableError instead of calling notFound() in production", async () => {
    getInteractionPairMock.mockRejectedValue(
      new InteractionDataUnavailableError("DB timeout")
    );
    await expect(
      InteractionPairPage({
        params: Promise.resolve({ herb: "turmeric", drug: "warfarin" }),
      })
    ).rejects.toBeInstanceOf(InteractionDataUnavailableError);
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("calls notFound() when pair is genuinely absent (null)", async () => {
    getInteractionPairMock.mockResolvedValue(null);
    await expect(
      InteractionPairPage({
        params: Promise.resolve({ herb: "turmeric", drug: "nonexistent" }),
      })
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledOnce();
  });

  it("renders all colliding records with a fail-safe warning and noindex metadata on InteractionUrlCollisionError", async () => {
    const collision = new InteractionUrlCollisionError(
      "sage",
      "anticonvulsants",
      [
        {
          id: "1",
          herbSlug: "sage",
          herbName: "Sage",
          herbScientificName: "Salvia officinalis",
          drugName: "Anticonvulsants",
          drugSlug: "anticonvulsants",
          severity: "moderate",
          description: "Moderate interaction text.",
          mechanism: null,
          evidenceLevel: "moderate-evidence",
          source: "Source A",
          sourceUrl: null,
          evidenceNote: null,
          updatedAt: "2026-11-20T00:00:00Z",
          hasFr: false,
        },
        {
          id: "2",
          herbSlug: "sage",
          herbName: "Sage",
          herbScientificName: "Salvia officinalis",
          drugName: "Anticonvulsants (Phenytoin, Valproate, Carbamazepine)",
          drugSlug: "anticonvulsants",
          severity: "severe",
          description: "Severe interaction text.",
          mechanism: null,
          evidenceLevel: "well-documented",
          source: "Source B",
          sourceUrl: null,
          evidenceNote: null,
          updatedAt: "2026-11-20T00:00:00Z",
          hasFr: false,
        },
      ]
    );
    getInteractionPairMock.mockRejectedValue(collision);

    const meta = await generateMetadata({
      params: Promise.resolve({ herb: "sage", drug: "anticonvulsants" }),
    });
    expect(meta.robots).toEqual({ index: false, follow: false });

    const el = await InteractionPairPage({
      params: Promise.resolve({ herb: "sage", drug: "anticonvulsants" }),
    });
    render(el);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/Moderate interaction text\./)).toBeInTheDocument();
    expect(screen.getByText(/Severe interaction text\./)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Anticonvulsants \(Phenytoin, Valproate, Carbamazepine\)/
      )
    ).toBeInTheDocument();
  });
});
