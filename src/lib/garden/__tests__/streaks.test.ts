import { describe, it, expect, beforeEach } from "vitest";
import {
  recordVisit,
  getStreak,
  recordHerbExplored,
  getExploredCount,
  getExploredHerbs,
} from "../streaks";

beforeEach(() => localStorage.clear());

describe("streaks", () => {
  it("starts a streak of 1 on first visit", () => {
    const s = recordVisit();
    expect(s.current).toBe(1);
    expect(s.longest).toBe(1);
    expect(getStreak()).toEqual({ current: 1, longest: 1 });
  });

  it("does not increment when visited twice on the same day", () => {
    recordVisit();
    const s = recordVisit();
    expect(s.current).toBe(1);
  });

  it("tracks explored herbs with dedupe", () => {
    expect(recordHerbExplored("ginger")).toBe(1);
    expect(recordHerbExplored("turmeric")).toBe(2);
    expect(recordHerbExplored("ginger")).toBe(2); // deduped
    expect(getExploredCount()).toBe(2);
    expect(getExploredHerbs()).toEqual(
      expect.arrayContaining(["ginger", "turmeric"])
    );
  });

  it("returns 0 / [] before anything is recorded", () => {
    expect(getExploredCount()).toBe(0);
    expect(getExploredHerbs()).toEqual([]);
    expect(getStreak()).toEqual({ current: 0, longest: 0 });
  });

  it("survives corrupted storage (throws -> defaults)", () => {
    localStorage.setItem("herbally-streak", "{not json");
    localStorage.setItem("herbally-explored-herbs", "{not json");
    expect(getStreak()).toEqual({ current: 0, longest: 0 });
    expect(getExploredHerbs()).toEqual([]);
  });
});
