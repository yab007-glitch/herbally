"use client";

const DAILY_HERB_KEY = "herbally-daily-herb";
const DAILY_HERB_DATE_KEY = "herbally-daily-herb-date";
const DAILY_HERB_VIEWED_KEY = "herbally-daily-herb-viewed";

export interface DailyHerb {
  slug: string;
  name: string;
  scientific_name: string;
  image_url?: string | null;
  benefit: string;
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Set the daily herb. Called by the server component or API.
 * For now, we accept a herb and store it as today's pick.
 */
export function setDailyHerb(herb: DailyHerb): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DAILY_HERB_KEY, JSON.stringify(herb));
  localStorage.setItem(DAILY_HERB_DATE_KEY, getToday());
  localStorage.removeItem(DAILY_HERB_VIEWED_KEY);
}

export function getDailyHerb(): DailyHerb | null {
  if (typeof window === "undefined") return null;
  try {
    const date = localStorage.getItem(DAILY_HERB_DATE_KEY);
    if (date !== getToday()) return null;
    const raw = localStorage.getItem(DAILY_HERB_KEY);
    return raw ? (JSON.parse(raw) as DailyHerb) : null;
  } catch {
    return null;
  }
}

export function markDailyHerbViewed(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DAILY_HERB_VIEWED_KEY, "true");
}

export function hasViewedDailyHerb(): boolean {
  if (typeof window === "undefined") return false;
  const viewed = localStorage.getItem(DAILY_HERB_VIEWED_KEY);
  const date = localStorage.getItem(DAILY_HERB_DATE_KEY);
  return viewed === "true" && date === getToday();
}
