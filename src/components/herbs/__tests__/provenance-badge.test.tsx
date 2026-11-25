import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations:
    () => (key: string, params?: Record<string, string | number>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
}));

import { ProvenanceBadge } from "../provenance-badge";
import { UNVERIFIED } from "@/lib/types/provenance";

describe("ProvenanceBadge role-aware & bulk-demoted rendering", () => {
  it("demotes 00079 bulk editorial import rows from 'humanReviewed' to an editorial-check badge", () => {
    render(
      <ProvenanceBadge
        provenance={{
          ...UNVERIFIED,
          review_status: "human_reviewed",
          reviewed_by_name: "Yasser Bheekun",
          reviewed_on: "2026-11-18",
          review_role: "editorial",
          bulk_editorial_import: true,
        }}
      />
    );
    expect(screen.queryByText("humanReviewed")).toBeNull();
    expect(screen.getByText("bulkEditorialImport")).toBeTruthy();
  });

  it("renders clinicallyReviewed when review_role is explicitly clinical", () => {
    render(
      <ProvenanceBadge
        provenance={{
          ...UNVERIFIED,
          review_status: "human_reviewed",
          reviewed_by_name: "Dr. Samira Patel",
          reviewed_on: "2026-11-22",
          review_role: "clinical",
          bulk_editorial_import: false,
        }}
      />
    );
    expect(screen.getByText("clinicallyReviewed")).toBeTruthy();
  });
});
