import { describe, it, expect, vi, beforeEach } from "vitest";

const getAnonClientMock = vi.fn();

vi.mock("@/lib/supabase/anonymous", () => ({
  getAnonClient: () => getAnonClientMock(),
}));

import { resolveHerb } from "../resolve-herb";
import { getHerbPairs, getInteractionPair } from "../pairs";
import { findPairUrlCollisions } from "../pair-url";
import { matchInteractionPairDetailed } from "../check";
import {
  InteractionDataUnavailableError,
  InteractionUrlCollisionError,
} from "../errors";

function mockHerbQueryClient(handlers: {
  onResolve?: (callIndex: number) => { data: unknown; error: unknown };
  onPairs?: () => { data: unknown; error: unknown };
}) {
  let resolveCall = 0;
  return {
    from: (table: string) => {
      const state: { table: string } = { table };
      const chain = {
        select: () => chain,
        eq: () => chain,
        or: () => chain,
        order: () => chain,
        limit: () => chain,
        abortSignal: () => chain,
        then: (
          resolve: (v: { data: unknown; error: unknown }) => unknown,
          reject?: (e: unknown) => unknown
        ) => {
          try {
            if (state.table === "herbs") {
              resolveCall += 1;
              return Promise.resolve(
                handlers.onResolve
                  ? handlers.onResolve(resolveCall)
                  : { data: [], error: null }
              ).then(resolve, reject);
            }
            return Promise.resolve(
              handlers.onPairs ? handlers.onPairs() : { data: [], error: null }
            ).then(resolve, reject);
          } catch (err) {
            return Promise.reject(err).catch(reject);
          }
        },
      };
      return chain;
    },
  };
}

describe("interaction DB availability guarantees", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolveHerb throws InteractionDataUnavailableError when Supabase client is null", async () => {
    getAnonClientMock.mockReturnValue(null);
    await expect(resolveHerb("turmeric")).rejects.toBeInstanceOf(
      InteractionDataUnavailableError
    );
  });

  it("resolveHerb throws InteractionDataUnavailableError when any herb query errors (partial failure)", async () => {
    // Previously `resolveHerb` only threw/returned null when ALL 3 queries errored,
    // and even then returned `null` instead of throwing.
    getAnonClientMock.mockReturnValue(
      mockHerbQueryClient({
        onResolve: (idx) =>
          idx === 1
            ? { data: null, error: { message: "statement timeout" } }
            : { data: [], error: null },
      })
    );
    await expect(resolveHerb("turmeric")).rejects.toBeInstanceOf(
      InteractionDataUnavailableError
    );
  });

  it("resolveHerb returns null cleanly when all queries succeed with 0 rows", async () => {
    getAnonClientMock.mockReturnValue(
      mockHerbQueryClient({
        onResolve: () => ({ data: [], error: null }),
      })
    );
    await expect(resolveHerb("nonexistent-herb-xyz")).resolves.toBeNull();
  });

  it("getHerbPairs throws InteractionDataUnavailableError when DB errors instead of returning []", async () => {
    getAnonClientMock.mockReturnValue(
      mockHerbQueryClient({
        onPairs: () => ({ data: null, error: { message: "connection reset" } }),
      })
    );
    await expect(getHerbPairs("turmeric")).rejects.toBeInstanceOf(
      InteractionDataUnavailableError
    );
  });

  it("getInteractionPair throws InteractionDataUnavailableError on DB error instead of returning null", async () => {
    getAnonClientMock.mockReturnValue(
      mockHerbQueryClient({
        onPairs: () => ({ data: null, error: { message: "timeout" } }),
      })
    );
    await expect(
      getInteractionPair("turmeric", "warfarin")
    ).rejects.toBeInstanceOf(InteractionDataUnavailableError);
  });
});

describe("interaction URL collision detection and fail-safe resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getInteractionPair throws InteractionUrlCollisionError with all colliding rows instead of silently picking one", async () => {
    const collidingRows = [
      {
        id: "row-mod",
        drug_name: "Anticonvulsants",
        severity: "moderate",
        description: "Moderate description",
        mechanism: null,
        evidence_level: "moderate-evidence",
        source: "Source A",
        source_url: null,
        evidence_note: null,
        updated_at: "2026-11-20T00:00:00Z",
        translations: null,
        herbs: {
          slug: "sage",
          name: "Sage",
          scientific_name: "Salvia officinalis",
          is_published: true,
          translations: null,
        },
      },
      {
        id: "row-sev",
        drug_name: "Anticonvulsants (Phenytoin, Valproate, Carbamazepine)",
        severity: "severe",
        description: "Severe description",
        mechanism: null,
        evidence_level: "well-documented",
        source: "Source B",
        source_url: null,
        evidence_note: null,
        updated_at: "2026-11-20T00:00:00Z",
        translations: null,
        herbs: {
          slug: "sage",
          name: "Sage",
          scientific_name: "Salvia officinalis",
          is_published: true,
          translations: null,
        },
      },
    ];

    getAnonClientMock.mockReturnValue(
      mockHerbQueryClient({
        onPairs: () => ({ data: collidingRows, error: null }),
      })
    );

    await expect(
      getInteractionPair("sage", "anticonvulsants")
    ).rejects.toBeInstanceOf(InteractionUrlCollisionError);

    try {
      await getInteractionPair("sage", "anticonvulsants");
    } catch (err) {
      expect(err).toBeInstanceOf(InteractionUrlCollisionError);
      const col = err as InteractionUrlCollisionError;
      expect(col.pairs).toHaveLength(2);
      expect(col.pairs.map((p) => p.severity)).toEqual(["moderate", "severe"]);
    }
  });

  it("findPairUrlCollisions flags colliding pair paths and severity conflicts", () => {
    const collisions = findPairUrlCollisions([
      {
        id: "1",
        herbSlug: "sage",
        drugName: "Anticonvulsants",
        severity: "moderate",
      },
      {
        id: "2",
        herbSlug: "sage",
        drugName: "Anticonvulsants (Phenytoin, Valproate, Carbamazepine)",
        severity: "severe",
      },
      {
        id: "3",
        herbSlug: "turmeric",
        drugName: "Warfarin (Coumadin)",
        severity: "severe",
      },
    ]);

    expect(collisions).toHaveLength(1);
    expect(collisions[0].path).toBe("/interactions/sage/anticonvulsants");
    expect(collisions[0].hasSeverityConflict).toBe(true);
    expect(collisions[0].rows).toHaveLength(2);
  });

  it("matchInteractionPairDetailed returns all colliding rows for exact slug, token, and French alias matches instead of picking the first row", () => {
    const pairs = [
      {
        id: "row-mod",
        herbSlug: "sage",
        drugName: "Anticonvulsants",
        drugSlug: "anticonvulsants",
        severity: "moderate",
      },
      {
        id: "row-sev",
        herbSlug: "sage",
        drugName: "Anticonvulsants (Phenytoin, Valproate, Carbamazepine)",
        drugSlug: "anticonvulsants",
        severity: "severe",
      },
    ];

    for (const query of [
      "anticonvulsants",
      "Anticonvulsants",
      "anticonvulsivants",
    ]) {
      const outcome = matchInteractionPairDetailed(query, pairs);
      expect(outcome.kind).toBe("collision");
      if (outcome.kind === "collision") {
        expect(outcome.drugSlug).toBe("anticonvulsants");
        expect(outcome.pairs).toHaveLength(2);
        expect(outcome.pairs.map((p) => p.severity)).toEqual([
          "moderate",
          "severe",
        ]);
      }
    }
  });
});
