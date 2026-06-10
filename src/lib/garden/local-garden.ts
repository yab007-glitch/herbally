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

export function addToGarden(herb: Omit<GardenHerb, "savedAt">): GardenHerb[] {
  if (typeof window === "undefined") return [];
  const garden = getGarden();
  if (garden.some((h) => h.slug === herb.slug)) return garden;
  const updated = [{ ...herb, savedAt: new Date().toISOString() }, ...garden];
  localStorage.setItem(GARDEN_KEY, JSON.stringify(updated));
  return updated;
}

export function removeFromGarden(slug: string): GardenHerb[] {
  if (typeof window === "undefined") return [];
  const garden = getGarden().filter((h) => h.slug !== slug);
  localStorage.setItem(GARDEN_KEY, JSON.stringify(garden));
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
