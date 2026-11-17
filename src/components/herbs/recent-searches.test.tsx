import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSaveSearch } from "./recent-searches";

const KEY = "herbally-recent-searches";
const saved = () => JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];

describe("useSaveSearch", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("ignores a half-typed fragment", () => {
    const { result } = renderHook(() => useSaveSearch());
    act(() => result.current("al"));
    expect(saved()).toEqual([]);
  });

  it("collapses one typing run to the longest term", () => {
    const { result } = renderHook(() => useSaveSearch());
    act(() => result.current("alo"));
    act(() => result.current("aloe"));
    act(() => result.current("aloe vera"));
    expect(saved()).toEqual(["aloe vera"]);
  });

  it("keeps distinct searches, newest first, capped at five", () => {
    const { result } = renderHook(() => useSaveSearch());
    for (const term of [
      "aloe",
      "ginger",
      "turmeric",
      "nettle",
      "garlic",
      "maca",
    ]) {
      act(() => result.current(term));
    }
    expect(saved()).toEqual(["maca", "garlic", "nettle", "turmeric", "ginger"]);
  });
});
