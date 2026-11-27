import { describe, expect, it } from "vitest";
import canonicalPairs from "./fixtures/canonical-142-medications.json";
import { matchInteractionPairDetailed } from "@/lib/interactions/check";
import { aggregateMedications } from "@/lib/interactions/medications";
import { drugSlug } from "@/lib/interactions/pair-url";
import type { InteractionPair } from "@/lib/interactions/pairs";
import { SEVERITY_WEIGHT } from "@/lib/interactions/stack";

describe("A4: Exhaustive 142-medication integration matrix & reverse lookup verification", () => {
  const pairs = canonicalPairs as unknown as InteractionPair[];
  const aggregated = aggregateMedications(pairs);
  const medications = Array.from(aggregated.values());

  it("aggregates all 509 curated pairs cleanly into all 142 medications and drug classes", () => {
    expect(pairs.length).toBe(509);
    expect(medications.length).toBe(142);

    const totalSum = medications.reduce(
      (sum, m) => sum + m.totalInteractions,
      0
    );
    expect(totalSum).toBe(509);
  });

  it("verifies slug determinism, bilingual URLs, severity aggregation, and drug matcher resolution across all 142 medications", () => {
    for (const med of medications) {
      expect(med.drugSlug).toMatch(/^[a-z0-9-]+$/);
      expect(drugSlug(med.enDrugName)).toBe(med.drugSlug);
      expect(med.totalInteractions).toBeGreaterThan(0);
      expect(med.publishedCount + med.legacyCount).toBe(med.totalInteractions);

      const sevTotal =
        med.countsBySeverity.contraindicated +
        med.countsBySeverity.severe +
        med.countsBySeverity.moderate +
        med.countsBySeverity.mild;
      expect(sevTotal).toBe(med.totalInteractions);

      const maxWeight = Math.max(
        ...med.interactions.map((ix) => SEVERITY_WEIGHT[ix.severity] ?? 0)
      );
      expect(SEVERITY_WEIGHT[med.highestSeverity]).toBe(maxWeight);

      const enUrl = `https://herbally.app/medications/${med.drugSlug}`;
      const frUrl = `https://herbally.app/fr/medications/${med.drugSlug}`;
      expect(enUrl).toMatch(
        /^https:\/\/herbally\.app\/medications\/[a-z0-9-]+$/
      );
      expect(frUrl).toMatch(
        /^https:\/\/herbally\.app\/fr\/medications\/[a-z0-9-]+$/
      );

      // Verify live matcher resolves both full parenthetical label and normalized base name
      const exactMatch = matchInteractionPairDetailed(
        med.enDrugName,
        med.interactions
      );
      expect(exactMatch.kind).not.toBe("none");

      const strippedTerm = med.enDrugName.split(" (")[0].trim().toLowerCase();
      if (strippedTerm.length >= 2) {
        const normalizedMatch = matchInteractionPairDetailed(
          strippedTerm,
          med.interactions
        );
        expect(normalizedMatch.kind).not.toBe("none");
      }
    }
  });

  it("fails closed on unknown synthetic medications and deduplicates equivalent normalized brand/generic drug labels", () => {
    expect(drugSlug("Warfarin (Coumadin)")).toBe("warfarin");
    expect(drugSlug("warfarin")).toBe("warfarin");

    const warfarin = aggregated.get("warfarin");
    expect(warfarin).toBeDefined();
    expect(warfarin!.totalInteractions).toBeGreaterThan(20);

    const unknownMatch = matchInteractionPairDetailed(
      "nonexistent-synthetic-rx-99999",
      warfarin!.interactions
    );
    expect(unknownMatch.kind).toBe("none");
  });
});
