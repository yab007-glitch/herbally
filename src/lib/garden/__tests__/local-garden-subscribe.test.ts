import { describe, it, expect, vi, beforeEach } from "vitest";

// Prevent background server-sync fetches from hitting the network.
vi.stubGlobal(
  "fetch",
  vi.fn().mockResolvedValue(new Response("{}", { status: 200 }))
);

const {
  addToGarden,
  removeFromGarden,
  setGarden,
  isInGarden,
  subscribeGarden,
} = await import("../local-garden");

const herb = (slug: string) => ({
  id: `id-${slug}`,
  slug,
  name: slug,
  scientific_name: `Sci ${slug}`,
  image_url: null,
});

beforeEach(() => {
  localStorage.clear();
  vi.mocked(fetch).mockImplementation(
    async () => new Response("{}", { status: 200 })
  );
});

describe("subscribeGarden", () => {
  it("notifies subscribers on add, remove and setGarden", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeGarden(listener);

    addToGarden(herb("ginger"));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(isInGarden("ginger")).toBe(true);

    // Re-adding an existing herb is a no-op and must not notify.
    addToGarden(herb("ginger"));
    expect(listener).toHaveBeenCalledTimes(1);

    removeFromGarden("ginger");
    expect(listener).toHaveBeenCalledTimes(2);
    expect(isInGarden("ginger")).toBe(false);

    setGarden([]);
    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribe();
    addToGarden(herb("mint"));
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("keeps isInGarden in step with direct storage writes", () => {
    const listener = vi.fn();
    subscribeGarden(listener);

    expect(isInGarden("turmeric")).toBe(false);

    // A write that bypasses the helpers (another tab, or a test) must still be
    // observed: the snapshot cache is keyed on the raw stored string.
    localStorage.setItem(
      "herbally-garden",
      JSON.stringify([{ ...herb("turmeric"), savedAt: "2026-01-01T00:00:00Z" }])
    );
    expect(isInGarden("turmeric")).toBe(true);

    localStorage.removeItem("herbally-garden");
    expect(isInGarden("turmeric")).toBe(false);
  });
});
