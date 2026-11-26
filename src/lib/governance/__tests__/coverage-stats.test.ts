import { describe, expect, it, vi } from "vitest";
import { fetchGovernanceCoverageStats } from "../coverage-stats";

function makeMockClient({
  totalHerbs = 3122,
  sourceChecked = 1840,
  clinicallyReviewed = 0,
  totalInteractions = 509,
  approvedInteractions = 0,
  corrections = [
    {
      id: "c1",
      affected_surface: "/interactions/ginger/warfarin",
      correction_summary: "Reconciled Jiang et al. 2005 evidence note.",
      corrected_at: "2026-11-26T12:00:00Z",
      verified_by: "Editorial team",
    },
  ],
}: {
  totalHerbs?: number;
  sourceChecked?: number;
  clinicallyReviewed?: number;
  totalInteractions?: number;
  approvedInteractions?: number;
  corrections?: Array<{
    id: string;
    affected_surface: string;
    correction_summary: string;
    corrected_at: string;
    verified_by: string | null;
  }>;
} = {}) {
  const fromMock = vi.fn((table: string) => {
    if (table === "herbs_public") {
      return {
        select: vi.fn(() => {
          const chain = {
            in: async () => ({ count: sourceChecked, error: null }),
            eq: vi.fn(() => ({
              eq: async () => ({ count: clinicallyReviewed, error: null }),
            })),
            then: (resolve: (v: unknown) => void) =>
              resolve({ count: totalHerbs, error: null }),
          };
          return chain;
        }),
      };
    }
    if (table === "drug_interactions") {
      return {
        select: vi.fn(() => ({
          eq: async () => ({ count: approvedInteractions, error: null }),
          then: (resolve: (v: unknown) => void) =>
            resolve({ count: totalInteractions, error: null }),
        })),
      };
    }
    if (table === "public_corrections_log") {
      return {
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: async () => ({ data: corrections, error: null }),
          })),
        })),
      };
    }
    return {};
  });
  return { from: fromMock };
}

describe("fetchGovernanceCoverageStats", () => {
  it("fails gracefully when anon client is unavailable", async () => {
    const res = await fetchGovernanceCoverageStats(null);
    expect(res.available).toBe(false);
    expect(res.totalHerbs).toBe(0);
    expect(res.corrections).toEqual([]);
  });

  it("computes live herb, interaction, and corrections metrics from anon queries", async () => {
    const client = makeMockClient({
      totalHerbs: 3122,
      sourceChecked: 1840,
      clinicallyReviewed: 12,
      totalInteractions: 509,
      approvedInteractions: 4,
    });
    const res = await fetchGovernanceCoverageStats(
      client as unknown as Parameters<typeof fetchGovernanceCoverageStats>[0]
    );
    expect(res.available).toBe(true);
    expect(res.totalHerbs).toBe(3122);
    expect(res.sourceCheckedHerbs).toBe(1840);
    expect(res.clinicallyReviewedHerbs).toBe(12);
    expect(res.totalInteractions).toBe(509);
    expect(res.clinicianApprovedInteractions).toBe(4);
    expect(res.legacyUnreviewedInteractions).toBe(505);
    expect(res.corrections).toHaveLength(1);
    expect(res.corrections[0].affected_surface).toBe(
      "/interactions/ginger/warfarin"
    );
  });
});
