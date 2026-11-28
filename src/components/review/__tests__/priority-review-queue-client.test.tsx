import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PriorityReviewQueueClient } from "../priority-review-queue-client";

vi.mock("@/components/i18n/localized-link", () => ({
  LocalizedLink: ({
    href,
    children,
    ...props
  }: ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const ITEMS = [
  {
    id: "1",
    herbSlug: "st-johns-wort",
    herbName: "St. John's Wort",
    drugName: "Cyclosporine",
    severity: "contraindicated" as const,
    evidenceLevel: "well-documented",
    source: "EMA HMPC",
  },
  {
    id: "2",
    herbSlug: "st-johns-wort",
    herbName: "St. John's Wort",
    drugName: "Rivaroxaban",
    severity: "severe" as const,
    evidenceLevel: "well-documented",
    source: "PubMed PMID:32478963",
  },
];

describe("PriorityReviewQueueClient", () => {
  it("filters priority pairs by severity and search query and renders intent=signoff links", () => {
    render(
      <PriorityReviewQueueClient
        locale="en"
        items={ITEMS}
        totalPriorityCount={80}
        totalActivePairs={515}
        clinicianSignedPairs={0}
        seatsFilled={0}
        seatsTotal={3}
        generatedAt="2026-11-28T00:00:00Z"
      />
    );

    expect(
      screen.getByText(/St\. John's Wort \+ Cyclosporine/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/St\. John's Wort \+ Rivaroxaban/)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Contraindicated/i }));
    expect(
      screen.getByText(/St\. John's Wort \+ Cyclosporine/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/St\. John's Wort \+ Rivaroxaban/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /All high-risk/i }));
    fireEvent.change(
      screen.getByLabelText(/Filter queue by herb or medication/i),
      { target: { value: "rivaroxaban" } }
    );
    expect(
      screen.getByText(/St\. John's Wort \+ Rivaroxaban/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/St\. John's Wort \+ Cyclosporine/)).toBeNull();
  });
});
