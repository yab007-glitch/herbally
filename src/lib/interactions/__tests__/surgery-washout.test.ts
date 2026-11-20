import { describe, expect, it } from "vitest";
import { buildSurgeryWashoutPlan, matchSurgeryHerb } from "../surgery-washout";

describe("surgery washout planner", () => {
  it("matches bilingual herb aliases cleanly", () => {
    expect(matchSurgeryHerb("millepertuis")?.slug).toBe("st-johns-wort");
    expect(matchSurgeryHerb("garlic")?.daysBefore).toBe(7);
    expect(matchSurgeryHerb("Ginkgo Biloba")?.daysBefore).toBe(14);
    expect(matchSurgeryHerb("chamomile")).toBeNull();
  });

  it("computes calendar stop dates and flags overdue windows", () => {
    const plan = buildSurgeryWashoutPlan(
      "2026-12-01",
      ["Ginkgo", "Garlic", "Unknown Tea"],
      "2026-11-20"
    );
    expect(plan).not.toBeNull();
    expect(plan!.daysUntilSurgery).toBe(11);
    expect(plan!.matched).toHaveLength(2);
    expect(plan!.matched[0]).toMatchObject({
      stopDateIso: "2026-11-17",
      alreadyPastWindow: true, // 14 days before Dec 1 is already passed on Nov 20
    });
    expect(plan!.matched[1]).toMatchObject({
      stopDateIso: "2026-11-24",
      alreadyPastWindow: false,
    });
    expect(plan!.unmatched).toEqual(["Unknown Tea"]);
  });

  it("returns null on malformed dates", () => {
    expect(buildSurgeryWashoutPlan("not-a-date", ["garlic"])).toBeNull();
  });
});
