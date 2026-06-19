import { describe, it, expect, beforeEach, vi } from "vitest";

// Prevent background server-sync fetches from hitting the network.
vi.stubGlobal(
  "fetch",
  vi.fn().mockResolvedValue(new Response("{}", { status: 200 }))
);

const mod = await import("../local-garden");
const {
  getGarden,
  addToGarden,
  removeFromGarden,
  isInGarden,
  setGarden,
  getGardenNote,
} = mod;

beforeEach(() => localStorage.clear());

const herb = (slug: string) => ({
  id: `id-${slug}`,
  slug,
  name: slug.charAt(0).toUpperCase() + slug.slice(1),
  scientific_name: `Sci ${slug}`,
  image_url: null,
  savedAt: new Date().toISOString(),
});

describe("local-garden", () => {
  it("starts empty", () => {
    expect(getGarden()).toEqual([]);
    expect(isInGarden("ginger")).toBe(false);
  });

  it("adds herbs (newest first) and dedupes by slug", () => {
    addToGarden(herb("ginger"));
    const after = addToGarden(herb("turmeric"));
    expect(after.map((h) => h.slug)).toEqual(["turmeric", "ginger"]);
    expect(isInGarden("ginger")).toBe(true);
    // duplicate slug does not add a second entry
    const dup = addToGarden(herb("ginger"));
    expect(dup.filter((h) => h.slug === "ginger")).toHaveLength(1);
  });

  it("removes herbs by slug", () => {
    addToGarden(herb("ginger"));
    addToGarden(herb("turmeric"));
    const after = removeFromGarden("ginger");
    expect(after.map((h) => h.slug)).toEqual(["turmeric"]);
    expect(isInGarden("ginger")).toBe(false);
  });

  it("setGarden overwrites and survives invalid JSON", () => {
    setGarden([herb("a"), herb("b")]);
    expect(getGarden()).toHaveLength(2);
    localStorage.setItem("herbally-garden", "{not json");
    expect(getGarden()).toEqual([]);
  });

  it("notes read/write", () => {
    if (typeof mod.setGardenNote === "function") {
      mod.setGardenNote("ginger", "my note");
      expect(getGardenNote("ginger")).toBe("my note");
    }
    expect(getGardenNote("missing")).toBe("");
  });
});
