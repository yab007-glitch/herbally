"use client";

export interface GardenHerb {
  id: string;
  slug: string;
  name: string;
  scientific_name: string;
  image_url?: string | null;
  savedAt: string;
  note?: string;
}

const GARDEN_KEY = "herbally-garden";
const NOTES_KEY = "herbally-garden-notes";
// Slugs the user intentionally removed. mergeServerGarden consults this so a
// herb that still exists server-side (e.g. the DELETE sync failed, or it was
// added on another device) doesn't silently reappear on next load. Capped to
// the most recent REMOVED_TOMBSTONE_MAX entries.
const TOMBSTONE_KEY = "herbally-garden-removed";
const REMOVED_TOMBSTONE_MAX = 100;
// L20 (audit 2026-06-22): slugs confirmed present on the server (after a
// successful POST sync). mergeServerGarden uses this to make the SERVER
// authoritative for removals across devices — if a slug is synced but absent
// from the server response, another device removed it and we drop it locally
// too. Without this, the tombstone was per-device only: a removal on device A
// never propagated to device B, which kept showing the herb until manually
// removed there as well.
const SYNCED_KEY = "herbally-garden-synced";
const SYNCED_MAX = 200;

export function getGarden(): GardenHerb[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GARDEN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GardenHerb[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getRemovedSlugs(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(TOMBSTONE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function addRemovedSlug(slug: string): void {
  if (typeof window === "undefined") return;
  try {
    const list = [...getRemovedSlugs()];
    if (!list.includes(slug)) list.push(slug);
    // Keep only the most recent entries to bound storage.
    const trimmed = list.slice(-REMOVED_TOMBSTONE_MAX);
    localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
}

function clearRemovedSlug(slug: string): void {
  if (typeof window === "undefined") return;
  try {
    const set = getRemovedSlugs();
    if (!set.has(slug)) return;
    set.delete(slug);
    localStorage.setItem(TOMBSTONE_KEY, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

function getSyncedSlugs(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(SYNCED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function markSynced(slug: string): void {
  if (typeof window === "undefined") return;
  try {
    const set = getSyncedSlugs();
    set.add(slug);
    // Bound storage; drop oldest beyond the cap.
    const list = [...set].slice(-SYNCED_MAX);
    localStorage.setItem(SYNCED_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

function clearSyncedSlugs(slugs: Iterable<string>): void {
  if (typeof window === "undefined") return;
  try {
    const set = getSyncedSlugs();
    let changed = false;
    for (const s of slugs) {
      if (set.has(s)) {
        set.delete(s);
        changed = true;
      }
    }
    if (changed) localStorage.setItem(SYNCED_KEY, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

export function setGarden(herbs: GardenHerb[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GARDEN_KEY, JSON.stringify(herbs));
  } catch {
    // Storage full or unavailable
  }
}

export function addToGarden(herb: Omit<GardenHerb, "savedAt">): GardenHerb[] {
  if (typeof window === "undefined") return [];
  const garden = getGarden();
  if (garden.some((h) => h.slug === herb.slug)) return garden;
  const updated = [{ ...herb, savedAt: new Date().toISOString() }, ...garden];
  localStorage.setItem(GARDEN_KEY, JSON.stringify(updated));
  // Re-adding clears any prior removal tombstone for this slug.
  clearRemovedSlug(herb.slug);

  // Sync to server in background
  syncHerbToServer(herb).catch(() => {
    // Silently fail — localStorage is the source of truth
  });

  return updated;
}

export function removeFromGarden(slug: string): GardenHerb[] {
  if (typeof window === "undefined") return [];
  const garden = getGarden().filter((h) => h.slug !== slug);
  localStorage.setItem(GARDEN_KEY, JSON.stringify(garden));
  // Record the removal so mergeServerGarden won't resurrect this slug.
  addRemovedSlug(slug);

  // Sync removal to server in background
  removeHerbFromServer(slug).catch(() => {
    // Silently fail
  });

  return garden;
}

export function isInGarden(slug: string): boolean {
  if (typeof window === "undefined") return false;
  return getGarden().some((h) => h.slug === slug);
}

export function getGardenNote(slug: string): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (!raw) return "";
    const notes = JSON.parse(raw) as Record<string, string>;
    return notes[slug] || "";
  } catch {
    return "";
  }
}

export function setGardenNote(slug: string, note: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    const notes = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    if (!note.trim()) {
      delete notes[slug];
    } else {
      notes[slug] = note;
    }
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Server sync helpers — called in the background, never block the UI
// ---------------------------------------------------------------------------

/**
 * Sync a single herb addition to the server.
 * Uses the existing /api/garden POST endpoint. The server derives the guest
 * identity from the HttpOnly `herbally-guest-id` cookie (sent automatically on
 * same-origin requests) — the client never sends a guestId, which it cannot
 * read anyway (HttpOnly).
 */
async function syncHerbToServer(
  herb: Omit<GardenHerb, "savedAt">
): Promise<void> {
  try {
    const res = await fetch("/api/garden", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        herbs: [
          {
            slug: herb.slug,
            name: herb.name,
            scientific_name: herb.scientific_name,
            image_url: herb.image_url,
            note: herb.note,
          },
        ],
      }),
    });
    // L20: only mark synced when the server actually accepted the write, so
    // mergeServerGarden can trust "synced but absent from server" as a real
    // cross-device removal rather than a never-synced local-only herb.
    if (res.ok) markSynced(herb.slug);
  } catch {
    // Silently fail — localStorage is the source of truth
  }
}

/**
 * Sync a herb removal to the server.
 */
async function removeHerbFromServer(slug: string): Promise<void> {
  try {
    await fetch(`/api/garden?slug=${encodeURIComponent(slug)}`, {
      method: "DELETE",
    });
  } catch {
    // Silently fail
  }
}

/**
 * Defensive normalizer for server rows. The API contract is `GardenHerb`
 * (camelCase), but older/stale payloads may still carry raw DB columns
 * (`herb_slug`, `herb_name`, `created_at`). Normalize so a shape drift can
 * never again produce "counted in stats, invisible in the grid" rows.
 */
function normalizeServerHerb(
  row: GardenHerb & {
    herb_slug?: string;
    herb_name?: string;
    created_at?: string;
  }
): GardenHerb {
  const slug = row.slug || row.herb_slug || "";
  return {
    id: row.id || slug,
    slug,
    name: row.name || row.herb_name || slug,
    scientific_name: row.scientific_name || "",
    image_url: row.image_url ?? null,
    savedAt: row.savedAt || row.created_at || new Date().toISOString(),
    note: row.note,
  };
}

/**
 * Merge server-side garden into localStorage on page load.
 * Call this once on the garden page to pull server data down.
 * Server data is additive — never removes items that only exist locally.
 */
export async function mergeServerGarden(): Promise<GardenHerb[]> {
  if (typeof window === "undefined") return getGarden();

  try {
    const response = await fetch("/api/garden");
    if (!response.ok) return getGarden();

    const data = (await response.json()) as { herbs?: GardenHerb[] };
    const serverHerbs: GardenHerb[] = (data.herbs ?? []).map(
      normalizeServerHerb
    );
    const serverSlugs = new Set(serverHerbs.map((h) => h.slug));

    const local = getGarden();
    // Don't resurrect herbs the user intentionally removed — see tombstone.
    const removedSlugs = getRemovedSlugs();

    // L20: server-authoritative removals. A slug that we previously confirmed
    // on the server but is now absent server-side was removed on another
    // device — drop it locally so the per-device tombstone is no longer the
    // only signal. Local-only herbs (never synced) are preserved (offline adds).
    const synced = getSyncedSlugs();
    const removedRemotely = local.filter(
      (h) => synced.has(h.slug) && !serverSlugs.has(h.slug)
    );
    let reconciled = local;
    if (removedRemotely.length > 0) {
      const removedSlugsSet = new Set(removedRemotely.map((h) => h.slug));
      reconciled = local.filter((h) => !removedSlugsSet.has(h.slug));
      clearSyncedSlugs(removedSlugsSet);
    }

    // Add server herbs not present locally (and not tombstoned).
    const reconciledSlugs = new Set(reconciled.map((h) => h.slug));
    const newHerbs = serverHerbs.filter(
      (h) => !reconciledSlugs.has(h.slug) && !removedSlugs.has(h.slug)
    );
    // Newly arrived server herbs are by definition synced.
    for (const h of newHerbs) markSynced(h.slug);

    if (removedRemotely.length > 0 || newHerbs.length > 0) {
      const merged = [...reconciled, ...newHerbs];
      localStorage.setItem(GARDEN_KEY, JSON.stringify(merged));
      return merged;
    }

    return local;
  } catch {
    return getGarden();
  }
}
