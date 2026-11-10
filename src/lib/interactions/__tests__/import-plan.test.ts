/**
 * Planner tests for the interaction importer. These run entirely in memory:
 * the plan is the reviewable artifact, so its insert/update classification and
 * idempotency must hold before any database client exists.
 */
import { describe, expect, it } from "vitest";
import {
  planImport,
  type PlannedRow,
} from "../../../../scripts/interactions/import";
import type {
  SeedFileEntry,
  SeedPair,
} from "../../../../scripts/interactions/seed";
import { drugSlug } from "../pair-url";

const TURMERIC_ID = "herb-turmeric";
const PUBLISHED = new Set(["turmeric"]);

function makePair(overrides: Partial<SeedPair> = {}): SeedPair {
  return {
    drug_name: "Warfarin (Coumadin)",
    severity: "severe",
    description:
      "Turmeric may increase the risk of bleeding when combined with warfarin.",
    mechanism: "Adds antiplatelet and anticoagulant effects.",
    evidence_level: "well-documented",
    source: "NIH ODS",
    source_licence: "us-federal-public-domain",
    source_url:
      "https://ods.od.nih.gov/factsheets/Turmeric-HealthProfessional/",
    ...overrides,
  };
}

function makeFile(pairs: SeedPair[]): SeedFileEntry {
  return {
    path: "data/interactions/turmeric.json",
    herbSlug: "turmeric",
    pairs,
  };
}

function emptyContext() {
  return {
    publishedHerbSlugs: PUBLISHED,
    existingByHerb: new Map(),
    herbIds: new Map([["turmeric", TURMERIC_ID]]),
  };
}

/** In-memory stand-in for public.drug_interactions' unique key. */
function rowKey(row: PlannedRow): string {
  return `${row.herb_id}\u0000${row.drug_name}`;
}

describe("planImport", () => {
  it("accepts a happy-path file into insert rows", () => {
    const pairs = [
      makePair(),
      makePair({
        drug_name: "Clopidogrel (Plavix)",
        description:
          "Turmeric may add to the antiplatelet effect of clopidogrel.",
      }),
    ];

    const plan = planImport([makeFile(pairs)], emptyContext());

    expect(plan.rejected).toEqual([]);
    expect(plan.accepted).toHaveLength(2);
    expect(plan.accepted.every((entry) => entry.action === "insert")).toBe(
      true
    );
    expect(plan.accepted[0].row).toEqual({
      herb_id: TURMERIC_ID,
      drug_name: "Warfarin (Coumadin)",
      rxcui: null,
      severity: "severe",
      description:
        "Turmeric may increase the risk of bleeding when combined with warfarin.",
      mechanism: "Adds antiplatelet and anticoagulant effects.",
      evidence_level: "well-documented",
      source: "NIH ODS",
      source_url:
        "https://ods.od.nih.gov/factsheets/Turmeric-HealthProfessional/",
      translations: null,
    });
    // Provenance stays on the accepted entry: the table has no licence column.
    expect(plan.accepted[0]).toMatchObject({
      source: "NIH ODS",
      sourceLicence: "us-federal-public-domain",
    });
    expect(plan.perHerb).toEqual([
      {
        herbSlug: "turmeric",
        existing: 0,
        incoming: 2,
        accepted: 2,
        newPairs: 2,
      },
    ]);
  });

  it("rejects a duplicate pair within the seed", () => {
    const pair = makePair();
    const plan = planImport([makeFile([pair, pair])], emptyContext());

    expect(plan.accepted).toHaveLength(1);
    expect(plan.rejected).toHaveLength(1);
    expect(plan.rejected[0]).toMatchObject({
      file: "data/interactions/turmeric.json",
      herbSlug: "turmeric",
      drugName: "Warfarin (Coumadin)",
      code: "DUPLICATE_PAIR",
    });
  });

  it("classifies an existing drug name as update and a new one as insert", () => {
    const context = {
      publishedHerbSlugs: PUBLISHED,
      existingByHerb: new Map([
        [
          "turmeric",
          [{ drugName: "Warfarin (Coumadin)", drugSlug: "warfarin" }],
        ],
      ]),
      herbIds: new Map([["turmeric", TURMERIC_ID]]),
    };

    const plan = planImport(
      [
        makeFile([
          makePair(),
          makePair({
            drug_name: "Clopidogrel (Plavix)",
            description:
              "Turmeric may add to the antiplatelet effect of clopidogrel.",
          }),
        ]),
      ],
      context
    );

    expect(plan.rejected).toEqual([]);
    const byKey = new Map(
      plan.accepted.map((entry) => [entry.pairKey, entry.action])
    );
    expect(byKey.get("turmeric/warfarin")).toBe("update");
    expect(byKey.get("turmeric/clopidogrel")).toBe("insert");
    expect(plan.perHerb).toEqual([
      {
        herbSlug: "turmeric",
        existing: 1,
        incoming: 2,
        accepted: 2,
        newPairs: 1,
      },
    ]);
  });

  it("is idempotent when re-planned against the rows it produced", () => {
    const files = [
      makeFile([
        makePair(),
        makePair({
          drug_name: "Clopidogrel (Plavix)",
          description:
            "Turmeric may add to the antiplatelet effect of clopidogrel.",
        }),
      ]),
    ];
    const firstPlan = planImport(files, emptyContext());

    const table = new Map<string, PlannedRow>();
    for (const entry of firstPlan.accepted) {
      table.set(rowKey(entry.row), entry.row);
    }
    const rowsBefore = new Map(table);
    expect(table.size).toBe(2);

    const existingByHerb = new Map<
      string,
      Array<{ drugName: string; drugSlug: string }>
    >();
    for (const row of table.values()) {
      const list = existingByHerb.get("turmeric") ?? [];
      list.push({
        drugName: row.drug_name,
        drugSlug: drugSlug(row.drug_name),
      });
      existingByHerb.set("turmeric", list);
    }

    const secondPlan = planImport(files, {
      publishedHerbSlugs: PUBLISHED,
      existingByHerb,
      herbIds: new Map([["turmeric", TURMERIC_ID]]),
    });

    const inserts = secondPlan.accepted.filter(
      (entry) => entry.action === "insert"
    );
    const updates = secondPlan.accepted.filter(
      (entry) => entry.action === "update"
    );
    expect(secondPlan.rejected).toEqual([]);
    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(2);

    for (const entry of secondPlan.accepted) {
      table.set(rowKey(entry.row), entry.row);
    }

    expect(table.size).toBe(rowsBefore.size);
    const persistedKeys = [...table.values()].map(rowKey);
    expect(new Set(persistedKeys).size).toBe(persistedKeys.length);
    expect(persistedKeys.sort()).toEqual([...rowsBefore.keys()].sort());
    for (const [key, row] of table) {
      expect(row).toEqual(rowsBefore.get(key));
    }
  });
});
