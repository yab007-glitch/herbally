import { describe, it, expect, beforeEach, vi } from "vitest";

// Prevent background server-sync fetches from hitting the network. The
// default responds 200 acknowledging any POSTed slugs; individual tests override
// the implementation to return server garden payloads or simulate failures.
vi.stubGlobal(
  "fetch",
  vi.fn().mockImplementation(async (_url, init?: RequestInit) => {
    if (init?.method === "POST" && typeof init.body === "string") {
      const parsed = JSON.parse(init.body) as { herbs?: { slug: string }[] };
      const slugs = (parsed.herbs ?? []).map((h) => h.slug);
      return new Response(
        JSON.stringify({
          saved: slugs.length,
          savedSlugs: slugs,
          errors: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (init?.method === "DELETE") {
      return new Response(JSON.stringify({ removed: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("{}", { status: 200 });
  })
);

const mod = await import("../local-garden");
const {
  getGarden,
  addToGarden,
  removeFromGarden,
  isInGarden,
  setGarden,
  getGardenNote,
  mergeServerGarden,
} = mod;

beforeEach(() => {
  localStorage.clear();
  vi.mocked(fetch).mockImplementation(async (_url, init?: RequestInit) => {
    if (init?.method === "POST" && typeof init.body === "string") {
      const parsed = JSON.parse(init.body) as { herbs?: { slug: string }[] };
      const slugs = (parsed.herbs ?? []).map((h) => h.slug);
      return new Response(
        JSON.stringify({
          saved: slugs.length,
          savedSlugs: slugs,
          errors: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (init?.method === "DELETE") {
      return new Response(JSON.stringify({ removed: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("{}", { status: 200 });
  });
});

// Flush the fire-and-forget syncHerbToServer POST so markSynced has run before
// we assert on merge behaviour.
const flushSync = () => new Promise((r) => setTimeout(r, 0));

const herb = (slug: string) => ({
  id: `id-${slug}`,
  slug,
  name: slug.charAt(0).toUpperCase() + slug.slice(1),
  scientific_name: `Sci ${slug}`,
  image_url: null,
  savedAt: new Date().toISOString(),
});

// Stub the GET /api/garden response with the given server-side herbs.
function stubServerGet(
  herbs: { slug: string; name: string; scientific_name: string }[]
) {
  vi.mocked(fetch).mockImplementation(async (url, init?: RequestInit) => {
    const u = typeof url === "string" ? url : (url as URL).toString();
    if (
      (!init?.method || init.method === "GET") &&
      u.includes("/api/garden") &&
      !u.includes("slug=")
    ) {
      return new Response(JSON.stringify({ herbs }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (init?.method === "POST" && typeof init.body === "string") {
      const parsed = JSON.parse(init.body) as { herbs?: { slug: string }[] };
      const slugs = (parsed.herbs ?? []).map((h) => h.slug);
      return new Response(
        JSON.stringify({
          saved: slugs.length,
          savedSlugs: slugs,
          errors: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(JSON.stringify({ removed: true }), { status: 200 });
  });
}

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

describe("mergeServerGarden — cross-device reconciliation (L20)", () => {
  it("pulls down server herbs not present locally", async () => {
    stubServerGet([
      { slug: "ginger", name: "Ginger", scientific_name: "Zingiber" },
    ]);
    const merged = await mergeServerGarden();
    expect(merged.map((h) => h.slug)).toContain("ginger");
    expect(isInGarden("ginger")).toBe(true);
  });

  it("removes a locally-synced herb that is absent server-side (cross-device removal)", async () => {
    // Add locally — the POST sync succeeds (200), so the slug is marked synced.
    addToGarden(herb("ginger"));
    await flushSync();
    expect(isInGarden("ginger")).toBe(true);

    // Server now reports ginger is gone (removed on another device).
    stubServerGet([]);
    const merged = await mergeServerGarden();
    expect(merged.find((h) => h.slug === "ginger")).toBeUndefined();
    expect(isInGarden("ginger")).toBe(false);
  });

  it("preserves local-only (never-synced) herbs when the server is empty", async () => {
    // Put a herb directly in localStorage without going through addToGarden,
    // so it is NOT marked synced — simulating an offline/local-only add.
    setGarden([herb("offline")]);
    stubServerGet([]);
    const merged = await mergeServerGarden();
    expect(merged.map((h) => h.slug)).toEqual(["offline"]);
    expect(isInGarden("offline")).toBe(true);
  });

  it("does not resurrect a herb the user intentionally removed (tombstone)", async () => {
    addToGarden(herb("ginger"));
    await flushSync();
    removeFromGarden("ginger"); // sets the tombstone
    expect(isInGarden("ginger")).toBe(false);

    // Server still has ginger (e.g. the DELETE sync failed) — must not reappear.
    stubServerGet([
      { slug: "ginger", name: "Ginger", scientific_name: "Zingiber" },
    ]);
    const merged = await mergeServerGarden();
    expect(merged.find((h) => h.slug === "ginger")).toBeUndefined();
  });

  it("normalizes raw DB-shaped server rows (herb_slug/herb_name) into renderable garden entries", async () => {
    // Regression: GET /api/garden once returned raw snake_case rows. They
    // were counted in stats but filtered out of the collection grid (no
    // `slug`), showing "1 Saved Herb" with an empty collection.
    vi.mocked(fetch).mockImplementation(async (url) => {
      const u = typeof url === "string" ? url : (url as URL).toString();
      if (u.includes("/api/garden") && !u.includes("slug=")) {
        return new Response(
          JSON.stringify({
            herbs: [
              {
                id: 7,
                guest_id: "26ff",
                herb_slug: "turmeric",
                herb_name: "Turmeric",
                scientific_name: "Curcuma longa",
                image_url: null,
                note: null,
                created_at: "2026-09-01T00:00:00.000Z",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("{}", { status: 200 });
    });
    const merged = await mergeServerGarden();
    expect(merged).toHaveLength(1);
    const row = merged[0];
    // Every field the garden grid renders must be populated.
    expect(row.slug).toBe("turmeric");
    expect(row.name).toBe("Turmeric");
    expect(row.scientific_name).toBe("Curcuma longa");
    expect(row.savedAt).toBe("2026-09-01T00:00:00.000Z");
    expect(isInGarden("turmeric")).toBe(true);
  });

  it("does NOT mark synced when POST returns HTTP 200 with saved:0 and errors, preserving local herb on merge", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ saved: 0, errors: ["ginger"] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    addToGarden(herb("ginger"));
    await flushSync();

    // Server returns empty because the POST failed silently; local herb MUST NOT be deleted.
    stubServerGet([]);
    const merged = await mergeServerGarden();
    expect(merged.map((h) => h.slug)).toContain("ginger");
    expect(isInGarden("ginger")).toBe(true);
  });

  it("keeps herb unsynced when POST returns HTTP 500 or unacknowledged body", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 })
    );
    addToGarden(herb("chamomile"));
    await flushSync();

    stubServerGet([]);
    const merged = await mergeServerGarden();
    expect(merged.map((h) => h.slug)).toContain("chamomile");
  });

  it("keeps synced flag untouched if DELETE fails and clears synced flag when DELETE succeeds", async () => {
    addToGarden(herb("ginger"));
    await flushSync();
    expect(
      JSON.parse(localStorage.getItem("herbally-garden-synced") ?? "[]")
    ).toContain("ginger");

    // Failed DELETE (500) must not clear synced tracking prematurely
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "db down" }), { status: 500 })
    );
    removeFromGarden("ginger");
    await flushSync();
    expect(
      JSON.parse(localStorage.getItem("herbally-garden-synced") ?? "[]")
    ).toContain("ginger");

    // Re-add, then succeed DELETE -> clears synced entry
    addToGarden(herb("ginger"));
    await flushSync();
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ removed: true, slug: "ginger" }), {
        status: 200,
      })
    );
    removeFromGarden("ginger");
    await flushSync();
    expect(
      JSON.parse(localStorage.getItem("herbally-garden-synced") ?? "[]")
    ).not.toContain("ginger");
  });

  it("preserves synced local herbs when GET /api/garden returns HTTP 200 with malformed or non-array payloads", async () => {
    addToGarden(herb("ginger"));
    await flushSync();
    expect(isInGarden("ginger")).toBe(true);

    const badPayloads = [
      JSON.stringify({}),
      JSON.stringify([]),
      JSON.stringify({ herbs: null }),
      JSON.stringify({ herbs: "bad" }),
      JSON.stringify({ herbs: [{ wrong: true }] }),
      "{malformed-json",
    ];

    for (const body of badPayloads) {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(body, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
      const merged = await mergeServerGarden();
      expect(merged.map((h) => h.slug)).toContain("ginger");
      expect(isInGarden("ginger")).toBe(true);
      expect(
        JSON.parse(localStorage.getItem("herbally-garden-synced") ?? "[]")
      ).toContain("ginger");
    }
  });
});
