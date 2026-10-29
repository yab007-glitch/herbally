import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reloadDocumentOnce } from "@/lib/ads/reload";

const KEY = "test:reload";
const T0 = 1_700_000_000_000;

function stubLocation() {
  const reload = vi.fn();
  Object.defineProperty(window, "location", {
    value: { href: "https://herbally.app/herbs/ginger", reload },
    writable: true,
    configurable: true,
  });
  return reload;
}

describe("reloadDocumentOnce", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    window.sessionStorage.clear();
  });

  it("reloads the document the first time", () => {
    const reload = stubLocation();
    reloadDocumentOnce(KEY, T0);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("refuses a second reload inside the cooldown window", () => {
    const reload = stubLocation();
    reloadDocumentOnce(KEY, T0);
    reloadDocumentOnce(KEY, T0 + 5_000);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("allows a reload again after the cooldown", () => {
    const reload = stubLocation();
    reloadDocumentOnce(KEY, T0);
    reloadDocumentOnce(KEY, T0 + 10_001);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("keeps independent keys independent", () => {
    const reload = stubLocation();
    reloadDocumentOnce("a", T0);
    reloadDocumentOnce("b", T0);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("still reloads when storage throws (private mode)", () => {
    const reload = stubLocation();
    const getItem = vi
      .spyOn(window.sessionStorage, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    reloadDocumentOnce(KEY, T0);
    expect(reload).toHaveBeenCalledTimes(1);
    getItem.mockRestore();
  });
});
