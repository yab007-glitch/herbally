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
    await fetch("/api/garden", {
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
    const serverHerbs: GardenHerb[] = data.herbs ?? [];
    if (serverHerbs.length === 0) return getGarden();

    const local = getGarden();
    const localSlugs = new Set(local.map((h) => h.slug));
    const newHerbs = serverHerbs.filter((h) => !localSlugs.has(h.slug));

    if (newHerbs.length > 0) {
      const merged = [...local, ...newHerbs];
      localStorage.setItem(GARDEN_KEY, JSON.stringify(merged));
      return merged;
    }

    return local;
  } catch {
    return getGarden();
  }
}
