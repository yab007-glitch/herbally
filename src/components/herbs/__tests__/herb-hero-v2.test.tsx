import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (namespace?: string) => (key: string) =>
    namespace ? `${namespace}.${key}` : key,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string | { pathname?: string };
    children: ReactNode;
  }) => (
    <a
      href={typeof href === "string" ? href : (href?.pathname ?? "#")}
      {...props}
    >
      {children}
    </a>
  ),
}));

vi.mock("@/components/herbs/HerbImage", () => ({
  HerbImage: ({ name }: { name: string }) => (
    <div data-testid="herb-image">{name}</div>
  ),
}));

vi.mock("@/components/herbs/evidence-grade", () => ({
  EvidenceGrade: ({ level }: { level: string }) => (
    <span data-testid="evidence-grade">{level}</span>
  ),
}));

vi.mock("@/components/herbs/provenance-badge", () => ({
  ProvenanceBadge: () => <span data-testid="provenance-badge" />,
}));

vi.mock("@/lib/garden/streaks", () => ({
  recordHerbExplored: vi.fn(),
}));

import { HerbHeroV2 } from "../herb-hero-v2";

function makeHeroHerb(overrides: Record<string, unknown> = {}) {
  return {
    id: "herb-1",
    slug: "zingiber-officinale",
    name: "Ginger",
    scientific_name: "Zingiber officinale",
    description: "Warming rhizome.",
    image_url: null,
    pregnancy_safe: false,
    nursing_safe: null,
    pregnancy_safe_oral: null,
    pregnancy_safe_topical: null,
    nursing_safe_oral: null,
    nursing_safe_topical: null,
    evidence_level: "A",
    contraindications: null,
    dosage_adult: "500 mg daily",
    dosage_forms: null,
    herb_categories: null,
    ...overrides,
  };
}

describe("HerbHeroV2 safety and review gating", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("forces unsafe pregnancy/nursing, shows toxicPlantBadge, suppresses EvidenceGrade and calculator, and warns when dangerous herb has 0 interactions", () => {
    const { container } = render(
      <HerbHeroV2
        herb={makeHeroHerb({
          slug: "atropa-belladonna-herb",
          name: "Belladonna",
          scientific_name: "Atropa belladonna",
          pregnancy_safe: true,
          nursing_safe: true,
          evidence_level: "A",
        })}
        provenance={{
          review_status: "needs_re_review",
          sources: ["PubMed"],
        }}
        interactions={[]}
        showCalculator={true}
      />
    );

    expect(screen.getAllByText("safetyGlance.unsafe")).toHaveLength(2);
    expect(screen.getByText("safetyGlance.toxicPlantBadge")).toBeDefined();
    expect(screen.queryByTestId("evidence-grade")).toBeNull();
    expect(container.querySelector('a[href*="/calculator"]')).toBeNull();
    expect(
      screen.getByText("safetyGlance.interactionDangerousNone")
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: /Suggest an edit/i })
    ).toBeDefined();
  });

  it("preserves explicit pregnancy_safe=false as unsafe while hiding pregnancy_safe=true as unknown on needs_re_review herbs", () => {
    const { rerender } = render(
      <HerbHeroV2
        herb={makeHeroHerb({
          slug: "zingiber-officinale",
          pregnancy_safe: false,
          nursing_safe: null,
        })}
        provenance={{
          review_status: "needs_re_review",
          sources: ["PubMed"],
        }}
        interactions={[]}
        showCalculator={true}
      />
    );

    expect(screen.getByText("safetyGlance.unsafe")).toBeDefined();
    expect(containerHasCalculatorLink()).toBe(true);

    rerender(
      <HerbHeroV2
        herb={makeHeroHerb({
          slug: "zingiber-officinale",
          pregnancy_safe: true,
          nursing_safe: true,
        })}
        provenance={{
          review_status: "needs_re_review",
          sources: ["PubMed"],
        }}
        interactions={[]}
        showCalculator={true}
      />
    );

    expect(screen.queryByText("safetyGlance.safe")).toBeNull();
    expect(
      screen.getAllByText("safetyGlance.unknown").length
    ).toBeGreaterThanOrEqual(2);
  });
});

function containerHasCalculatorLink() {
  return document.querySelector('a[href*="/calculator"]') !== null;
}
